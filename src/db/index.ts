import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ensureEmbeddedSchema } from "./embedded";

const embedded = process.env.VAQTBAN_EMBEDDED === "1";

let dbInstance: NodePgDatabase;
export let pool: Pool | undefined;

if (embedded) {
  // حالت جاسازی‌شده (نسخه دسکتاپ): پستگرس WASM بدون هیچ نصب بیرونی
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/pglite");
  const dataDir = process.env.VAQTBAN_DATA_DIR || "./vaqtban-pgdata";

  const g = globalThis as typeof globalThis & { __vaqtbanPGlite?: unknown };
  if (!g.__vaqtbanPGlite) {
    g.__vaqtbanPGlite = new PGlite(dataDir);
  }
  const client = g.__vaqtbanPGlite as import("@electric-sql/pglite").PGlite;
  dbInstance = drizzle(client) as unknown as NodePgDatabase;
  // ساخت جداول در پس‌زمینه؛ قبل از اولین کوئری در layout تضمین می‌شود
} else {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  const globalForDb = globalThis as typeof globalThis & {
    __arenaNextJsPostgresqlPool?: Pool;
  };
  pool =
    globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({
      connectionString: databaseUrl,
    });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }
  dbInstance = drizzleNodePg(pool);
}

export const db = dbInstance;

/** در حالت جاسازی‌شده، اسکیما را قبل از کوئری‌ها تضمین می‌کند (در غیر اینصورت بی‌اثر) */
export async function ensureDbReady(): Promise<void> {
  if (!embedded) return;
  const g = globalThis as typeof globalThis & { __vaqtbanPGlite?: unknown };
  const client = g.__vaqtbanPGlite as { exec(sql: string): Promise<unknown>; waitReady?: Promise<unknown> };
  await ensureEmbeddedSchema(client);
}
