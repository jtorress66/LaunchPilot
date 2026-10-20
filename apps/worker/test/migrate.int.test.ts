import { describe, expect, inject, it } from "vitest";
import { runMigrations } from "../src/container";

describe("pnpm db:migrate", () => {
  it("applies migrations and syncs the curated directory catalogue, idempotently", async () => {
    const first = await runMigrations({ connectionString: inject("databaseUrl") });
    if (!first.ok) throw new Error(first.error);
    expect(first.value.directories.upserted).toBeGreaterThan(0);
    const again = await runMigrations({ connectionString: inject("databaseUrl") });
    expect(again).toMatchObject({
      ok: true,
      value: { applied: [], directories: { upserted: first.value.directories.upserted } },
    });
  });
});
