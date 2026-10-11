import { effectivePlan, isActive } from "@launchpilot/domain";
import { describe, expect, it } from "vitest";
import { aSession, aSubscription, aUser } from "./accounts";
import { fixtureNow } from "./entities";

describe("account fixtures", () => {
  it("build a user with a normalised email", () => {
    expect(aUser({ email: "Founder@Acme.dev" }).email).toBe("founder@acme.dev");
  });

  it("build an active session", () => {
    expect(isActive(aSession(), fixtureNow)).toBe(true);
  });

  it.each(["free", "starter", "growth"] as const)("build a %s subscription", (plan) => {
    expect(effectivePlan(aSubscription({ plan }), fixtureNow)).toBe(plan);
  });

  it("build a past-due paid subscription through a real update", () => {
    expect(aSubscription({ plan: "starter", status: "past_due" }).status).toBe("past_due");
  });
});
