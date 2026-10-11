import { createDatabase, migrateToLatest, SystemClock } from "@launchpilot/adapters";
import type { DatabaseConfig } from "./config";
import type { HeartbeatDeps } from "./heartbeat";

/** Composition root: the only place in the worker where concrete adapters are created. */
export const container = {
  clock: new SystemClock(),
  version: process.env.APP_VERSION ?? "0.1.0",
  log: (line: string) => {
    process.stdout.write(`${line}\n`);
  },
} satisfies HeartbeatDeps;

/** Opens a single connection, applies pending migrations and closes it again. */
export const runMigrations = async ({ connectionString }: DatabaseConfig) => {
  const db = createDatabase(connectionString, 1);
  try {
    return await migrateToLatest(db);
  } finally {
    await db.destroy();
  }
};
