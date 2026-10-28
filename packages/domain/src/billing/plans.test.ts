import { describe, expect, it } from "vitest";
import { userId, workspaceId } from "../shared/ids";
import type { Workspace } from "../workspace/workspace";
import { isPaidPlan, planIds, plans } from "./plans";
import { workspacePlan } from "./workspace-plan";
import { freeSubscription, type Subscription } from "./subscription";

describe("plan catalog", () => {
  it("offers Free, Starter, Growth and Agency, plus the plan agency clients run on", () => {
    expect(planIds).toEqual(["free", "starter", "growth", "agency", "client"]);
    expect(plans.free).toMatchObject({
      name: "Free",
      priceMonthlyUsd: 0,
      limits: { products: 1, contentItemsPerMonth: 10 },
    });
    expect(plans.starter).toMatchObject({
      name: "Starter",
      priceMonthlyUsd: 29,
      limits: { products: 1, contentItemsPerMonth: 60 },
    });
    expect(plans.growth).toMatchObject({
      name: "Growth",
      priceMonthlyUsd: 79,
      limits: { products: 3, contentItemsPerMonth: 200 },
    });
  });

  it("sells Agency at $199 with Growth limits for itself and room for 10 clients", () => {
    expect(plans.agency).toMatchObject({
      name: "Agency",
      priceMonthlyUsd: 199,
      limits: { products: 3, contentItemsPerMonth: 200, clients: 10 },
    });
    expect(plans.client).toMatchObject({
      priceMonthlyUsd: 0,
      limits: { products: 3, contentItemsPerMonth: 200, clients: 0 },
    });
    for (const id of ["free", "starter", "growth"] as const)
      expect(plans[id].limits.clients).toBe(0);
  });

  it("only sells Starter, Growth and Agency", () => {
    expect(planIds.filter(isPaidPlan)).toEqual(["starter", "growth", "agency"]);
  });
});

describe("workspacePlan", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  const agency: Workspace = {
    id: workspaceId("ws_agency"),
    ownerId: userId("usr_1"),
    name: "Brightside",
    agencyId: null,
    createdAt: now,
  };
  const client: Workspace = { ...agency, id: workspaceId("ws_client"), agencyId: agency.id };
  const on = (
    plan: Subscription["plan"],
    status: Subscription["status"] = "active",
  ): Subscription => ({
    ...freeSubscription(agency.id, now),
    plan,
    status,
  });

  it("is a workspace's own plan when it is not a client", () => {
    expect(workspacePlan({ workspace: agency, own: on("growth"), agency: undefined, now })).toBe(
      "growth",
    );
  });

  it("puts a client on the client plan while its agency pays for Agency", () => {
    expect(workspacePlan({ workspace: client, own: on("free"), agency: on("agency"), now })).toBe(
      "client",
    );
  });

  it("drops a client to Free when its agency leaves the Agency plan", () => {
    expect(workspacePlan({ workspace: client, own: on("free"), agency: on("growth"), now })).toBe(
      "free",
    );
    expect(
      workspacePlan({ workspace: client, own: on("free"), agency: on("agency", "canceled"), now }),
    ).toBe("free");
    expect(workspacePlan({ workspace: client, own: on("free"), agency: undefined, now })).toBe(
      "free",
    );
  });
});
