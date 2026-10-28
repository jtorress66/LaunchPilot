import { userId, workspaceId } from "@nuvantre/domain";
import { aSession, aSubscription, aUser } from "@nuvantre/testing";
import { sql } from "kysely";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PostgresSessionRepository, PostgresUserRepository } from "../../src/postgres";
import { subscriptionMapper } from "../../src/postgres/mappers/subscription-mapper";
import { userMapper } from "../../src/postgres/mappers/user-mapper";
import { connect, resetWith } from "./test-db";

const db = connect();

beforeEach(async () => {
  await resetWith(db, "workspaces");
});
afterAll(async () => {
  await db.destroy();
});

describe("accounts in Postgres", () => {
  it("refuses a second account whose email differs only in case", async () => {
    const row = { ...userMapper.toRow(aUser({ id: userId("user_2") })), email: "FOUNDER@acme.dev" };
    await expect(db.insertInto("users").values(row).execute()).rejects.toThrow(
      /users_email_unique/,
    );
  });

  it("never stores the raw session token, only its SHA-256 hash", async () => {
    const session = aSession({ token: "super-secret-session-token-0123456789abcdef" });
    await new PostgresSessionRepository(db).save(session);
    const rows = await sql<{ token_hash: string }>`SELECT token_hash FROM sessions`.execute(db);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows.rows)).not.toContain(session.token);
  });

  it("deletes a user's sessions together with the user", async () => {
    const session = aSession();
    await new PostgresSessionRepository(db).save(session);
    await db.deleteFrom("subscriptions").execute();
    await db.deleteFrom("workspaces").execute();
    await db.deleteFrom("users").execute();
    expect(await new PostgresSessionRepository(db).findByToken(session.token)).toBeUndefined();
  });

  it("refuses a workspace whose owner does not exist", async () => {
    await expect(
      sql`INSERT INTO workspaces (id, owner_id, name, created_at) VALUES ('ws_x', 'user_missing', 'X', now())`.execute(
        db,
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it.each([
    ["an unknown plan", { plan: "enterprise" }, /subscriptions_plan_check/],
    ["an unknown status", { status: "frozen" }, /subscriptions_status_check/],
  ])("refuses a subscription with %s", async (_case, change, message) => {
    const row = {
      ...subscriptionMapper.toRow(aSubscription({ workspaceId: workspaceId("ws_1") })),
      ...change,
    };
    await expect(db.insertInto("subscriptions").values(row).execute()).rejects.toThrow(message);
  });

  it("stores an Agency subscription, but never the client plan, which is not sold", async () => {
    const agency = {
      ...subscriptionMapper.toRow(
        aSubscription({ workspaceId: workspaceId("ws_1"), plan: "agency" }),
      ),
    };
    await expect(db.insertInto("subscriptions").values(agency).execute()).resolves.toBeDefined();
    const client = {
      ...subscriptionMapper.toRow(
        aSubscription({ workspaceId: workspaceId("ws_2"), plan: "growth" }),
      ),
      plan: "client",
    };
    await expect(db.insertInto("subscriptions").values(client).execute()).rejects.toThrow(
      /subscriptions_plan_check/,
    );
  });

  it("finds a user by email regardless of the case it is looked up with", async () => {
    const repo = new PostgresUserRepository(db);
    const user = await repo.findById(userId("user_founder"));
    expect(user?.email).toBe("founder@acme.dev");
  });
});
