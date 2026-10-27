import { describe, expect, it } from "vitest";
import { productId, workspaceId } from "../shared/ids";
import { createProduct, setProductLocale } from "./product";

const now = new Date("2026-01-01T00:00:00.000Z");
const input = {
  id: productId("prod_1"),
  workspaceId: workspaceId("ws_1"),
  name: "Acme Analytics",
  url: "https://acme.dev",
  now,
};

describe("product", () => {
  it("is created for its workspace with a normalised URL", () => {
    expect(createProduct(input)).toEqual({
      ok: true,
      value: {
        id: "prod_1",
        workspaceId: "ws_1",
        name: "Acme Analytics",
        url: "https://acme.dev/",
        createdAt: now,
        autopilotSince: null,
        locale: { language: "en", market: "US" },
      },
    });
  });

  it("rejects an invalid URL", () => {
    const result = createProduct({ ...input, url: "javascript:alert(1)" });
    expect(result.ok ? undefined : result.error.code).toBe("invalid_url");
  });

  it("rejects an empty name", () => {
    const result = createProduct({ ...input, name: "" });
    expect(result.ok ? undefined : result.error.code).toBe("invalid_text");
  });
});

describe("product locale", () => {
  it("writes in US English until the founder picks a language and market", () => {
    const created = createProduct(input);
    if (!created.ok) throw new Error(created.error.message);
    expect(created.value.locale).toEqual({ language: "en", market: "US" });
    expect(setProductLocale(created.value, "pt-BR")).toEqual({
      ok: true,
      value: { ...created.value, locale: { language: "pt", market: "BR" } },
    });
  });

  it("refuses a locale it cannot read", () => {
    const created = createProduct(input);
    if (!created.ok) throw new Error(created.error.message);
    expect(setProductLocale(created.value, "klingon")).toMatchObject({
      ok: false,
      error: { code: "invalid_locale" },
    });
  });
});
