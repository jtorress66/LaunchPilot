import { enableAutopilot, setProductLocale } from "@nuvantre/domain";
import { aProduct } from "@nuvantre/testing";
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
      locale: "en-US",
      archived_at: null,
      slot_order: product.slotOrder,
    });
  });

  it("round-trips an archived product and its place in the plan's slots", () => {
    const product = {
      ...aProduct(),
      archivedAt: new Date("2026-10-20T10:00:00.000Z"),
      slotOrder: new Date("2026-10-21T11:00:00.000Z"),
    };
    expect(productMapper.fromRow(productMapper.toRow(product))).toEqual(product);
  });

  it("stores the language and market as a tag and reads it back", () => {
    const product = setProductLocale(aProduct(), "pt-BR");
    if (!product.ok) throw new Error(product.error.message);
    expect(productMapper.toRow(product.value).locale).toBe("pt-BR");
    expect(productMapper.fromRow(productMapper.toRow(product.value))).toEqual(product.value);
  });

  it("refuses a stored locale it cannot read, because that means corrupt data", () => {
    const row = { ...productMapper.toRow(aProduct()), locale: "klingon" };
    expect(() => productMapper.fromRow(row)).toThrow(/products\.locale/);
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
