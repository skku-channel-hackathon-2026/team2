import { AsyncLocalStorage } from "node:async_hooks";

// A small shared contract keeps local Node development independent of Workers types.
export type BindValue = string | number | boolean | null | ArrayBuffer;

export interface AppRunResult {
  success?: boolean;
  meta?: {
    changes?: number;
    last_row_id?: number;
    rows_read?: number;
    rows_written?: number;
  };
}

export interface AppStatement {
  bind(...values: BindValue[]): AppStatement;
  run(): Promise<AppRunResult>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface AppDatabase {
  prepare(sql: string): AppStatement;
  batch(statements: AppStatement[]): Promise<AppRunResult[]>;
}

const databaseContext = new AsyncLocalStorage<AppDatabase>();

export function withDatabase<T>(database: AppDatabase, callback: () => T): T {
  return databaseContext.run(database, callback);
}

export function getDatabase(): AppDatabase {
  const database = databaseContext.getStore();
  if (!database)
    throw new Error(
      "D1 requires the Cloudflare runtime; use pnpm dev:cloudflare",
    );
  return database;
}

export function hasDatabase(): boolean {
  return databaseContext.getStore() !== undefined;
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  ...values: BindValue[]
): Promise<T | null> {
  return getDatabase()
    .prepare(sql)
    .bind(...values)
    .first<T>();
}

export async function queryAll<T = Record<string, unknown>>(
  sql: string,
  ...values: BindValue[]
): Promise<T[]> {
  const { results } = await getDatabase()
    .prepare(sql)
    .bind(...values)
    .all<T>();
  return results ?? [];
}

export async function execute(
  sql: string,
  ...values: BindValue[]
): Promise<AppRunResult> {
  return getDatabase()
    .prepare(sql)
    .bind(...values)
    .run();
}

export function changedRows(result: AppRunResult): number {
  return result.meta?.changes ?? 0;
}
