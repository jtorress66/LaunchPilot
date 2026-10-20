import { enableAutopilot } from "@launchpilot/domain";
import { aProduct } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { productMapper } from "./product-mapper";

describe("productMapper", () => {
  it("maps a product to snake_case columns", () => {
    const product = aProduct();
    expect(productMapper.toRow(product)).toEqual({
      id: "prod_1",
      workspace_id: "ws_1",
      name: "Acme Analytics",
      url: "https://acme.dev/",
      created_at: product.createdAt,
      autopilot_since: null,
    });
  });

  it("round-trips when the autopilot was switched on", () => {
    const product = enableAutopilot(aProduct(), new Date("2026-10-19T09:00:00.000Z"));
    expect(productMapper.fromRow(productMapper.toRow(product))).toEqual(product);
  });

  it("round-trips a product", () => {
    const product = aProduct();
    expect(productMapper.fromRow(productMapper.toRow(product))).toEqual(product);
  });

  it("refuses a stored URL that is not http(s), because that means corrupt data", () => {
    const row = { ...productMapper.toRow(aProduct()), url: "javascript:alert(1)" };
    expect(() => productMapper.fromRow(row)).toThrow(/products\.url/);
  });
});
