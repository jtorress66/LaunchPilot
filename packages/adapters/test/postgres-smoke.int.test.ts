import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("Postgres test infrastructure", () => {
  let container: StartedPostgreSqlContainer | undefined;
  let client: pg.Client | undefined;

  beforeAll(async () => {
    const started = await new PostgreSqlContainer("postgres:16-alpine").start();
    container = started;
    const connected = new pg.Client({ connectionString: started.getConnectionUri() });
    await connected.connect();
    client = connected;
  });

  afterAll(async () => {
    // Guarded so a failed start reports its own error instead of a teardown TypeError.
    await client?.end();
    await container?.stop();
  });

  it("starts a disposable Postgres 16 database that answers queries", async () => {
    if (!client) throw new Error("Postgres client was not started");
    const result = await client.query<{ answer: number; version: string }>(
      "SELECT 1 AS answer, current_setting('server_version') AS version",
    );
    expect(result.rows[0]?.answer).toBe(1);
    expect(result.rows[0]?.version).toMatch(/^16\./);
  });
});
