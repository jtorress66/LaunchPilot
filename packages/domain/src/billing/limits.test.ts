import { describe, expect, it } from "vitest";
import { checkCanCreateProduct } from "./limits";

describe("checkCanCreateProduct", () => {
  it.each([
    ["free", 0],
    ["starter", 0],
    ["growth", 2],
  ] as const)("lets a %s workspace with %i products add one", (plan, count) => {
    expect(checkCanCreateProduct(plan, count)).toEqual({ ok: true, value: null });
  });

  it.each([
    ["free", 1, "The Free plan includes 1 product. Upgrade to add more."],
    ["starter", 1, "The Starter plan includes 1 product. Upgrade to add more."],
    ["growth", 3, "The Growth plan includes 3 products. Upgrade to add more."],
  ] as const)("stops a %s workspace at %i products", (plan, count, message) => {
    expect(checkCanCreateProduct(plan, count)).toEqual({
      ok: false,
      error: { code: "plan_limit_reached", message },
    });
  });
});
