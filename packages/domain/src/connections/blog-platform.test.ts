import { describe, expect, it } from "vitest";
import { blogPlatformIds, blogPlatforms, isBlogPlatform } from "./blog-platform";

describe("blogPlatforms", () => {
  it("lists WordPress, Ghost, Shopify, Webflow and Wix, each with a name and a secret to paste", () => {
    expect(blogPlatformIds).toEqual(["wordpress", "ghost", "shopify", "webflow", "wix"]);
    for (const id of blogPlatformIds) {
      const platform = blogPlatforms[id];
      expect(platform.name).not.toBe("");
      expect(platform.secret.label).not.toBe("");
      expect(platform.secret.hint).not.toBe("");
    }
  });

  it("asks each platform only for what it needs besides the address and the secret", () => {
    expect(blogPlatforms.wordpress.fields.map((f) => f.key)).toEqual(["username"]);
    expect(blogPlatforms.ghost.fields).toEqual([]);
    expect(blogPlatforms.shopify.fields).toEqual([]);
    expect(blogPlatforms.webflow.fields.map((f) => f.key)).toEqual(["collectionId"]);
    expect(blogPlatforms.wix.fields.map((f) => f.key)).toEqual(["siteId"]);
  });

  it("recognises its own platform ids only", () => {
    expect(isBlogPlatform("ghost")).toBe(true);
    expect(isBlogPlatform("medium")).toBe(false);
  });
});
