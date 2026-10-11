import { aSession, aSubscription, aUser } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { sessionMapper } from "./session-mapper";
import { subscriptionMapper } from "./subscription-mapper";
import { userMapper } from "./user-mapper";

describe("account mappers", () => {
  it("round-trips a user", () => {
    const user = aUser();
    expect(userMapper.fromRow(userMapper.toRow(user))).toEqual(user);
  });

  it("refuses a stored email that is not valid", () => {
    expect(() => userMapper.fromRow({ ...userMapper.toRow(aUser()), email: "nope" })).toThrow(
      /users\.email/,
    );
  });

  it("stores a session under the SHA-256 of its token and never the token itself", () => {
    const session = aSession();
    const row = sessionMapper.toRow(session);
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(session.token);
    expect(sessionMapper.fromRow(row, session.token)).toEqual(session);
  });

  it.each([
    ["free", "active"],
    ["starter", "active"],
    ["growth", "past_due"],
  ] as const)("round-trips a %s %s subscription", (plan, status) => {
    const subscription = aSubscription({ plan, status });
    expect(subscriptionMapper.fromRow(subscriptionMapper.toRow(subscription))).toEqual(
      subscription,
    );
  });

  it("refuses an unknown plan", () => {
    const row = { ...subscriptionMapper.toRow(aSubscription()), plan: "enterprise" };
    expect(() => subscriptionMapper.fromRow(row)).toThrow(/subscriptions\.plan/);
  });
});
