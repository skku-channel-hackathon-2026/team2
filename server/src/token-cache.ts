import type {
  CachedToken,
  TokenCacheStorage,
} from "@channel.io/app-sdk-server";
import { execute, hasDatabase, queryOne } from "./database.js";

interface TokenRow {
  access_token: string;
  refresh_token: string;
  cached_at: string;
  expires_at: string;
}

/**
 * Workers recycles isolates, so the SDK's default in-memory cache re-issues a
 * token on every cold start. issueToken/refreshToken share a 10 calls / 30 min
 * budget per app, so the token pair is shared through D1 instead.
 *
 * Token values are never logged.
 */
export class D1TokenCache implements TokenCacheStorage {
  private readonly fallback = new Map<string, CachedToken>();

  async get(key: string): Promise<CachedToken | null> {
    if (!hasDatabase()) return this.fallback.get(key) ?? null;

    const row = await queryOne<TokenRow>(
      "SELECT access_token, refresh_token, cached_at, expires_at FROM app_tokens WHERE cache_key = ?",
      key,
    );
    if (!row) return null;

    const expiresAt = Date.parse(row.expires_at);
    const cachedAt = Date.parse(row.cached_at);
    if (!Number.isFinite(expiresAt)) return null;
    if (expiresAt <= Date.now()) {
      await this.delete(key);
      return null;
    }

    return {
      key,
      cachedAt: Number.isFinite(cachedAt) ? cachedAt : Date.now(),
      expiresAt,
      token: {
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        expiresIn: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
      },
    };
  }

  async set(key: string, token: CachedToken): Promise<void> {
    if (!hasDatabase()) {
      this.fallback.set(key, token);
      return;
    }

    const now = new Date().toISOString();
    await execute(
      `INSERT INTO app_tokens (cache_key, access_token, refresh_token, cached_at, expires_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         cached_at = excluded.cached_at,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`,
      key,
      token.token.accessToken,
      token.token.refreshToken,
      new Date(token.cachedAt).toISOString(),
      new Date(token.expiresAt).toISOString(),
      now,
    );
  }

  async delete(key: string): Promise<void> {
    if (!hasDatabase()) {
      this.fallback.delete(key);
      return;
    }
    await execute("DELETE FROM app_tokens WHERE cache_key = ?", key);
  }

  async clear(): Promise<void> {
    if (!hasDatabase()) {
      this.fallback.clear();
      return;
    }
    await execute("DELETE FROM app_tokens");
  }
}
