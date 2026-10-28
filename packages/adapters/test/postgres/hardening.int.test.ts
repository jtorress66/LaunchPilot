import {
  describeAuditTrailContract,
  describeJobLockContract,
  describeRateLimiterContract,
} from "@nuvantre/testing/contracts";
import { FixedClock } from "@nuvantre/testing";
import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import {
  createDatabase,
  PostgresAuditTrail,
  PostgresJobLock,
  PostgresRateLimiter,
  PostgresReadinessProbe,
} from "../../src/postgres";
import { connect, resetWith } from "./test-db";

const db = connect();
const other = connect();
afterAll(async () => {
  await Promise.all([db.destroy(), other.destroy()]);
});

const clearLimits = () => sql`TRUNCATE rate_limits`.execute(db);

describeRateLimiterContract("PostgresRateLimiter", async () => {
  await clearLimits();
  const clock = new FixedClock(new Date("2026-10-28T09:00:00.000Z"));
  return { limiter: new PostgresRateLimiter(db, clock), clock };
});

describeAuditTrailContract("PostgresAuditTrail", async () => {
  await resetWith(db, "workspaces");
  return new PostgresAuditTrail(db);
});

describeJobLockContract("PostgresJobLock", () => ({
  // Two connection pools, as two worker processes would have.
  first: new PostgresJobLock(db),
  second: new PostgresJobLock(other),
}));

describe("PostgresRateLimiter", () => {
  const rule = { limit: 10, windowSeconds: 60 };

  it("never lets more through than the limit, even when requests race", async () => {
    await clearLimits();
    const clock = new FixedClock(new Date("2026-10-28T09:00:00.000Z"));
    const limiter = new PostgresRateLimiter(db, clock);
    const racing = new PostgresRateLimiter(other, clock);
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) => (i % 2 ? limiter : racing).consume("login:x", rule)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
  });

  it("purges windows that have ended", async () => {
    await clearLimits();
    const clock = new FixedClock(new Date("2026-10-28T09:00:00.000Z"));
    const limiter = new PostgresRateLimiter(db, clock);
    await limiter.consume("login:old", rule);
    clock.set(new Date("2026-10-28T10:00:00.000Z"));
    await limiter.consume("login:new", rule);
    expect(await limiter.purgeBefore(new Date("2026-10-28T09:30:00.000Z"))).toBe(1);
    const left = await sql<{ key: string }>`SELECT key FROM rate_limits`.execute(db);
    expect(left.rows).toEqual([{ key: "login:new" }]);
  });
});

describe("PostgresReadinessProbe", () => {
  it("is ready while the database answers", async () => {
    expect(await new PostgresReadinessProbe(db).check()).toEqual({ ready: true });
  });

  it("says why it is not ready, without the connection string, when the database is down", async () => {
    const down = createDatabase("postgres://app:s3cret@127.0.0.1:1/nuvantre");
    const result = await new PostgresReadinessProbe(down, 1_000).check();
    await down.destroy();
    expect(result).toMatchObject({ ready: false });
    expect(JSON.stringify(result)).not.toContain("s3cret");
  });
});
