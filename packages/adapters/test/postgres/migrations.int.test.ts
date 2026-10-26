import { sql, type Kysely } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inject } from "vitest";
import { createDatabase, migrateDown, migrateToLatest, type Database } from "../../src/postgres";

/** Runs against its own scratch database so it never disturbs the shared, migrated one. */
const admin = createDatabase(inject("databaseUrl"));
let db: Kysely<Database>;

const tables = async () => {
  const result = await sql<{ table_name: string }>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name NOT LIKE 'kysely_%'
    ORDER BY table_name`.execute(db);
  return result.rows.map((row) => row.table_name);
};

const scratchDatabase = async (name: string) => {
  await sql`DROP DATABASE IF EXISTS ${sql.id(name)}`.execute(admin);
  await sql`CREATE DATABASE ${sql.id(name)}`.execute(admin);
  const url = new URL(inject("databaseUrl"));
  url.pathname = `/${name}`;
  return createDatabase(url.toString());
};

beforeAll(async () => {
  db = await scratchDatabase("migrations_scratch");
});

afterAll(async () => {
  await db.destroy();
  await admin.destroy();
});

describe("migrations", () => {
  it("creates every table when migrating to the latest version", async () => {
    expect(await migrateToLatest(db)).toEqual({
      ok: true,
      value: {
        applied: [
          "0001_initial",
          "0002_accounts_billing",
          "0003_seo",
          "0004_social",
          "0005_launch",
          "0006_analytics",
          "0007_orchestration",
        ],
      },
    });
    expect(await tables()).toEqual([
      "analytics_connections",
      "autopilot_runs",
      "briefs",
      "campaigns",
      "channel_connections",
      "content_items",
      "directories",
      "launch_kits",
      "products",
      "sessions",
      "social_profiles",
      "submissions",
      "subscriptions",
      "tasks",
      "users",
      "weekly_reports",
      "workspaces",
    ]);
  });

  it("does nothing when run again", async () => {
    expect(await migrateToLatest(db)).toEqual({ ok: true, value: { applied: [] } });
  });

  it("removes every table when migrated back down", async () => {
    expect(await migrateDown(db)).toEqual({
      ok: true,
      value: {
        applied: [
          "0007_orchestration",
          "0006_analytics",
          "0005_launch",
          "0004_social",
          "0003_seo",
          "0002_accounts_billing",
          "0001_initial",
        ],
      },
    });
    expect(await tables()).toEqual([]);
  });

  it("reports a migration that fails as an error result instead of throwing", async () => {
    const conflicting = await scratchDatabase("migrations_conflict");
    await sql`CREATE TABLE workspaces (id text)`.execute(conflicting);
    const result = await migrateToLatest(conflicting);
    await conflicting.destroy();
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("already exists") as unknown,
    });
  });
});
