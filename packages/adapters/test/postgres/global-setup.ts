import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";
import { createDatabase, migrateToLatest } from "../../src/postgres";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** One disposable Postgres 16 per integration run, migrated to the latest schema. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const databaseUrl = container.getConnectionUri();
  const db = createDatabase(databaseUrl);
  const migrated = await migrateToLatest(db);
  await db.destroy();
  if (!migrated.ok) throw new Error(`Migration failed: ${migrated.error}`);
  project.provide("databaseUrl", databaseUrl);
  return async () => {
    await container.stop();
  };
}
