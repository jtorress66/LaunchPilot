import { describe, expect, it } from "vitest";
import { isPaidPlan, planIds, plans } from "./plans";

describe("plan catalog", () => {
  it("offers Free, Starter and Growth with the agreed prices and limits", () => {
    expect(planIds).toEqual(["free", "starter", "growth"]);
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

  it("only sells Starter and Growth", () => {
    expect(planIds.filter(isPaidPlan)).toEqual(["starter", "growth"]);
  });
});
