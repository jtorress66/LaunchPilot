import { describe, expect, it } from "vitest";
import { checkCanCreateContent, checkCanCreateProduct } from "./limits";

describe("checkCanCreateProduct", () => {
  it.each([
    ["free", 0],
    ["starter", 0],
    ["growth", 2],
  ] as const)("lets a %s workspace with %i products add one", (plan, count) => {
    expect(checkCanCreateProduct(plan, count)).toEqual({ ok: true, value: null });
  });

  it.each([
    ["free", 1, "The Free plan includes 1 product. Upgrade or archive one to add more."],
    ["starter", 1, "The Starter plan includes 1 product. Upgrade or archive one to add more."],
    ["growth", 3, "The Growth plan includes 3 products. Upgrade or archive one to add more."],
  ] as const)("stops a %s workspace at %i products", (plan, count, message) => {
    expect(checkCanCreateProduct(plan, count)).toEqual({
      ok: false,
      error: { code: "plan_limit_reached", message },
    });
  });
});

describe("checkCanCreateContent", () => {
  it.each([
    ["free", 9],
    ["starter", 59],
    ["growth", 199],
  ] as const)(
    "lets a %s workspace that created %i items this month draft another",
    (plan, used) => {
      expect(checkCanCreateContent(plan, used)).toEqual({ ok: true, value: null });
    },
  );

  it.each([
    ["free", 10, "The Free plan includes 10 content items a month. Upgrade to create more."],
    ["growth", 200, "The Growth plan includes 200 content items a month. Upgrade to create more."],
  ] as const)("stops a %s workspace at %i items this month", (plan, used, message) => {
    expect(checkCanCreateContent(plan, used)).toEqual({
      ok: false,
      error: { code: "plan_limit_reached", message },
    });
  });
});
