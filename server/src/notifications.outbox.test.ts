import assert from "node:assert/strict";
import test from "node:test";
import {
  withDatabase,
  type AppDatabase,
  type AppStatement,
  type BindValue,
} from "./database.js";
import { NotificationsService } from "./notifications.service.js";
import type { ChannelService } from "./channel.service.js";

interface Row {
  id: string;
  dedupe_key: string;
  kind: string;
  target_type: "group" | "user_chat";
  target_id: string | null;
  target_user_id: string | null;
  root_message_id: string | null;
  body_json: string;
  due_at: string;
  status: string;
  attempts: number;
}

/**
 * Recognises only the statements NotificationsService issues. Every method
 * yields so two concurrent runDue() calls interleave the way separate Workers
 * isolates do against the same D1.
 */
class FakeDatabase implements AppDatabase {
  readonly rows = new Map<string, Row>();

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
        await Promise.resolve();
        return { meta: { changes: self.run(sql, values) } };
      },
      first: async () => {
        await Promise.resolve();
        return null;
      },
      all: async <T>() => {
        await Promise.resolve();
        return { results: self.select(sql, values) as T[] };
      },
    };
  }

  private select(sql: string, values: BindValue[]): Row[] {
    if (sql.includes("primary_user_chat_id")) return [];
    if (!sql.includes("FROM notifications")) return [];

    const now = String(values[0]);
    const limit = Number(values[1] ?? 100);
    return [...this.rows.values()]
      .filter((row) => row.status === "pending" && row.due_at <= now)
      .sort((left, right) => left.due_at.localeCompare(right.due_at))
      .slice(0, limit);
  }

  private run(sql: string, values: BindValue[]): number {
    if (sql.includes("SET status = 'sending'")) {
      const respectsDueAt = sql.includes("due_at <= ?");
      const id = String(values[2]);
      const row = this.rows.get(id);
      if (!row || row.status !== "pending") return 0;
      if (respectsDueAt && row.due_at > String(values[3])) return 0;
      row.status = "sending";
      return 1;
    }

    if (sql.includes("SET status = 'sent'")) {
      const row = this.rows.get(String(values[2]));
      if (row) row.status = "sent";
      return row ? 1 : 0;
    }

    if (sql.includes("SET status = ?, attempts = ?")) {
      const row = this.rows.get(String(values[5]));
      if (!row) return 0;
      row.status = String(values[0]);
      row.attempts = Number(values[1]);
      row.due_at = String(values[3]);
      return 1;
    }

    return 0;
  }
}

const failingChannel = {
  postToGroup: async () => {
    throw new Error("offline");
  },
  postToUserChat: async () => {
    throw new Error("offline");
  },
  logFailure: () => {},
} as unknown as ChannelService;

function seed(database: FakeDatabase, count: number): void {
  for (let index = 0; index < count; index += 1) {
    const id = `ntf_${index}`;
    database.rows.set(id, {
      id,
      dedupe_key: id,
      kind: "test",
      target_type: "group",
      target_id: "group-1",
      target_user_id: null,
      root_message_id: null,
      body_json: JSON.stringify({ text: "hello" }),
      due_at: "2026-01-01T00:00:00.000Z",
      status: "pending",
      attempts: 0,
    });
  }
}

test("concurrent runners deliver each notification at most once", async () => {
  const database = new FakeDatabase();
  seed(database, 3);
  const service = new NotificationsService(failingChannel);

  const summaries = await withDatabase(database, () =>
    Promise.all([
      service.runDue("ch", 20),
      service.runDue("ch", 20),
      service.runDue("ch", 20),
    ]),
  );

  const processed = summaries.reduce((total, run) => total + run.processed, 0);
  assert.equal(processed, 3, "each row must be claimed exactly once");
});

test("a failed notification is not retried before its backoff elapses", async () => {
  const database = new FakeDatabase();
  seed(database, 1);
  const service = new NotificationsService(failingChannel);

  const [first, second] = await withDatabase(database, async () => [
    await service.runDue("ch", 20),
    await service.runDue("ch", 20),
  ]);

  assert.equal(first.processed, 1);
  assert.equal(first.failed, 1);
  assert.equal(second.processed, 0, "backoff must defer the retry");
  assert.equal(database.rows.get("ntf_0")?.status, "pending");
});
