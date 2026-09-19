import assert from "node:assert/strict";
import test from "node:test";
import {
  withDatabase,
  type AppDatabase,
  type AppStatement,
  type BindValue,
} from "./database.js";
import { D1TokenCache } from "./token-cache.js";

interface TokenRow {
  cache_key: string;
  access_token: string;
  refresh_token: string;
  cached_at: string;
  expires_at: string;
}

/** Recognises only the statements D1TokenCache issues against app_tokens. */
class FakeDatabase implements AppDatabase {
  readonly rows = new Map<string, TokenRow>();

  prepare(sql: string): AppStatement {
    return this.statement(sql, []);
  }

  async batch(): Promise<never[]> {
    return [];
  }

  private statement(sql: string, values: BindValue[]): AppStatement {
    const self = this;
    return {
      bind: (...next: BindValue[]) => self.statement(sql, next),
      run: async () => {
        if (sql.startsWith("INSERT INTO app_tokens")) {
          self.rows.set(String(values[0]), {
            cache_key: String(values[0]),
            access_token: String(values[1]),
            refresh_token: String(values[2]),
            cached_at: String(values[3]),
            expires_at: String(values[4]),
          });
        } else if (sql.startsWith("DELETE FROM app_tokens WHERE")) {
          self.rows.delete(String(values[0]));
        } else if (sql.startsWith("DELETE FROM app_tokens")) {
          self.rows.clear();
        }
        return { meta: { changes: 1 } };
      },
      first: async <T>() =>
        (self.rows.get(String(values[0])) ?? null) as T | null,
      all: async <T>() => {
        const row = self.rows.get(String(values[0]));
        return { results: (row ? [row] : []) as T[] };
      },
    };
  }
}

function cached(expiresInMs: number) {
  return {
    key: "channel:ch-1",
    cachedAt: Date.now(),
    expiresAt: Date.now() + expiresInMs,
    token: {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: Math.floor(expiresInMs / 1000),
    },
  };
}

test("tokens survive across isolates through D1", async () => {
  const database = new FakeDatabase();

  await withDatabase(database, async () => {
    const writer = new D1TokenCache();
    await writer.set("channel:ch-1", cached(60_000));
  });

  // A fresh instance stands in for a cold isolate with an empty memory cache.
  const restored = await withDatabase(database, () =>
    new D1TokenCache().get("channel:ch-1"),
  );

  assert.equal(restored?.token.accessToken, "access-token");
  assert.equal(restored?.token.refreshToken, "refresh-token");
});

test("expired tokens are evicted instead of returned", async () => {
  const database = new FakeDatabase();
  const cache = new D1TokenCache();

  await withDatabase(database, async () => {
    await cache.set("channel:ch-1", cached(-1_000));
    assert.equal(await cache.get("channel:ch-1"), null);
  });

  assert.equal(database.rows.size, 0, "expired row must be deleted");
});

test("falls back to memory when D1 is unavailable", async () => {
  const cache = new D1TokenCache();
  await cache.set("app", { ...cached(60_000), key: "app" });
  const restored = await cache.get("app");
  assert.equal(restored?.token.accessToken, "access-token");
});

/** Reproduces an unapplied migration: the binding works, the table does not. */
class MissingTableDatabase implements AppDatabase {
  calls = 0;

  prepare(): AppStatement {
    const fail = () => {
      this.calls += 1;
      return Promise.reject(
        new Error("D1_ERROR: no such table: app_tokens: SQLITE_ERROR"),
      );
    };
    const statement: AppStatement = {
      bind: () => statement,
      run: fail,
      first: fail,
      all: fail,
    };
    return statement;
  }

  async batch(): Promise<never[]> {
    return [];
  }
}

test("a missing app_tokens table degrades to memory instead of throwing", async () => {
  const database = new MissingTableDatabase();
  const cache = new D1TokenCache();

  await withDatabase(database, async () => {
    await cache.set("app", { ...cached(60_000), key: "app" });
    const restored = await cache.get("app");
    assert.equal(restored?.token.accessToken, "access-token");
    assert.equal(database.calls, 1, "D1 must not be retried once degraded");
  });
});
