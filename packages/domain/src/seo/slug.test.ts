import { describe, expect, it } from "vitest";
import { parseSlug, slugify } from "./slug";

describe("slugify", () => {
  it.each([
    ["Cookieless analytics for SaaS founders", "cookieless-analytics-for-saas-founders"],
    ["Café & crème: the 5 best tools!", "cafe-creme-the-5-best-tools"],
    ["  Über  Datenschutz -- im   Web ", "uber-datenschutz-im-web"],
    ["Análise sem cookies", "analise-sem-cookies"],
    ["Cookie 分析 ツール", "cookie-分析-ツール"],
    ["Аналитика без cookie", "аналитика-без-cookie"],
  ])("turns %j into %j", (text, slug) => {
    expect(slugify(text)).toBe(slug);
  });

  it("keeps slugs to 75 characters without cutting a word in half", () => {
    const slug = slugify("privacy friendly analytics ".repeat(10));
    expect(slug.length).toBeLessThanOrEqual(75);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).toMatch(/(privacy|friendly|analytics)$/);
  });

  it("is empty when nothing usable is left", () => {
    expect(slugify("!!! ??? ---")).toBe("");
  });
});

describe("parseSlug", () => {
  it("accepts a slug that slugify would leave as it is", () => {
    expect(parseSlug("cookieless-analytics")).toEqual({ ok: true, value: "cookieless-analytics" });
    expect(parseSlug(" cookie-分析 ")).toEqual({ ok: true, value: "cookie-分析" });
  });

  it.each(["", "Cookieless Analytics", "two--hyphens", "-leading", "café", "a/b"])(
    "refuses %j",
    (slug) => {
      expect(parseSlug(slug)).toMatchObject({ ok: false, error: { code: "invalid_slug" } });
    },
  );
});
