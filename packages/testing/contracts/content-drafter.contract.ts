import { linksOutside, parseSlug } from "@nuvantre/domain";
import type { ContentDrafter, DraftRequest } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";
import { aBriefContent } from "../src/fixtures/entities";

export interface ContentDrafterHarness {
  readonly drafter: ContentDrafter;
  givenFailure(): void | Promise<void>;
}

const request: DraftRequest = {
  brief: aBriefContent(),
  channel: "blog",
  task: { kind: "seo_article", title: "How solo founders can market a SaaS" },
  keywords: ["saas marketing"],
  locale: { language: "en", market: "GB" },
  internalLinks: [
    { title: "Pricing your first SaaS", url: "https://acme.dev/blog/pricing-your-first-saas" },
  ],
};

export function describeContentDrafterContract(
  name: string,
  make: () => ContentDrafterHarness | Promise<ContentDrafterHarness>,
): void {
  describe(`ContentDrafter contract: ${name}`, () => {
    it("returns a draft with a title and body", async () => {
      const { drafter } = await make();
      const result = await drafter.draft(request);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.title.trim()).not.toBe("");
      expect(result.value.body.trim()).not.toBe("");
    });

    it("cites only facts from the brief", async () => {
      const { drafter } = await make();
      const result = await drafter.draft(request);
      if (!result.ok) throw new Error(result.error.message);
      for (const fact of result.value.citedFacts) expect(request.brief.facts).toContain(fact);
    });

    it("returns a valid slug and a short excerpt whenever it returns search metadata", async () => {
      const { drafter } = await make();
      const result = await drafter.draft(request);
      if (!result.ok) throw new Error(result.error.message);
      const { seo } = result.value;
      if (seo === undefined) return;
      expect(parseSlug(seo.slug)).toEqual({ ok: true, value: seo.slug });
      expect(seo.excerpt.trim()).not.toBe("");
      expect(seo.excerpt.length).toBeLessThanOrEqual(300);
    });

    it("links only to the published articles it was given", async () => {
      const { drafter } = await make();
      const result = await drafter.draft(request);
      if (!result.ok) throw new Error(result.error.message);
      expect(linksOutside(result.value.body, request.internalLinks ?? [])).toEqual([]);
    });

    it("reports a failure as a DraftError result instead of throwing", async () => {
      const harness = await make();
      await harness.givenFailure();
      const result = await harness.drafter.draft(request);
      expect(result.ok).toBe(false);
    });
  });
}
