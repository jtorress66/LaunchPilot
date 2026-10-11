import { describe, expect, it } from "vitest";
import { campaignId, productId } from "../shared/ids";
import { createCampaign, transitionCampaign } from "./campaign";

const weekStarting = new Date("2026-01-05T00:00:00.000Z");
const planned = () => {
  const result = createCampaign({
    id: campaignId("camp_1"),
    productId: productId("prod_1"),
    name: "Week 2 growth loop",
    goal: "Publish two SEO articles",
    weekStarting,
  });
  if (!result.ok) throw new Error("setup failed");
  return result.value;
};

describe("campaign", () => {
  it("is created as planned for its week", () => {
    expect(planned()).toEqual({
      id: "camp_1",
      productId: "prod_1",
      name: "Week 2 growth loop",
      goal: "Publish two SEO articles",
      weekStarting,
      status: "planned",
    });
  });

  it("rejects an empty name", () => {
    const result = createCampaign({
      id: campaignId("camp_1"),
      productId: productId("prod_1"),
      name: "",
      goal: "Goal",
      weekStarting,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty goal", () => {
    const result = createCampaign({
      id: campaignId("camp_1"),
      productId: productId("prod_1"),
      name: "Name",
      goal: " ",
      weekStarting,
    });
    expect(result.ok).toBe(false);
  });

  it("moves from planned to active to completed", () => {
    const active = transitionCampaign(planned(), "start");
    if (!active.ok) throw new Error("start failed");
    expect(active.value.status).toBe("active");
    expect(transitionCampaign(active.value, "complete")).toMatchObject({
      ok: true,
      value: { status: "completed" },
    });
  });

  it("cannot complete a campaign that never started", () => {
    const result = transitionCampaign(planned(), "complete");
    expect(result.ok ? undefined : result.error.code).toBe("invalid_transition");
  });
});
