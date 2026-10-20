import { describe, expect, it } from "vitest";
import { productId, workspaceId } from "../shared/ids";
import { createProduct } from "./product";

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
