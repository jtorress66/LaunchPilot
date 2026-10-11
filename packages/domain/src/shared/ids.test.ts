import { describe, expect, it } from "vitest";
import {
  briefId,
  campaignId,
  contentItemId,
  productId,
  taskId,
  userId,
  workspaceId,
  type WorkspaceId,
} from "./ids";

describe("ids", () => {
  it.each([workspaceId, productId, briefId, campaignId, taskId, contentItemId, userId])(
    "%o brands a non-empty string without changing its value",
    (make) => {
      expect(make("id_1")).toBe("id_1");
    },
  );

  it("keeps the brand in the type", () => {
    const id: WorkspaceId = workspaceId("ws_1");
    expect(id).toBe("ws_1");
  });

  it("throws for an empty id because that is a programmer error", () => {
    expect(() => productId("")).toThrow(TypeError);
  });
});
