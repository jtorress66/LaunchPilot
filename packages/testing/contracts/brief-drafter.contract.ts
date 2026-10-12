import { isGrounded, parseHttpUrl } from "@launchpilot/domain";
import type { BriefDrafter, BriefDraftRequest, CrawledSite } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";

export interface BriefDrafterHarness {
  readonly drafter: BriefDrafter;
  /**
   * Arrange for the next draft to fail. A drafter that only fails on bad input
   * returns the request that makes it fail.
   */
  givenFailure(): BriefDraftRequest | undefined | Promise<BriefDraftRequest | undefined>;
}

const url = parseHttpUrl("https://acme.dev/");
if (!url.ok) throw new Error(url.error.message);

/** The site every contract test drafts from; harnesses may script replies against it. */
export const briefDrafterContractSite: CrawledSite = {
  url: url.value,
  pages: [
    {
      url: "https://acme.dev/",
      title: "Acme Analytics — privacy-friendly analytics for SaaS founders",
      text: [
        "Acme Analytics",
        "Privacy-friendly analytics for SaaS founders.",
        "Know which pages bring signups without cookie banners.",
        "Founders waste hours in bloated dashboards that track everything but answer nothing.",
        "Acme shows the five numbers that matter in one weekly email.",
      ].join("\n"),
    },
    {
      url: "https://acme.dev/pricing",
      title: "Pricing — Acme Analytics",
      text: [
        "Pricing",
        "Start with a free 14-day trial. No credit card required.",
        "Acme is GDPR compliant and never uses cookies.",
        "Setup takes two minutes with one script tag.",
      ].join("\n"),
    },
  ],
};

const request: BriefDraftRequest = { productName: "Acme Analytics", site: briefDrafterContractSite };

/** What a drafter may quote from: the title and text of every crawled page. */
const corpus = briefDrafterContractSite.pages.map((p) => `${p.title}\n${p.text}`).join("\n\n");

export function describeBriefDrafterContract(
  name: string,
  make: () => BriefDrafterHarness | Promise<BriefDrafterHarness>,
): void {
  describe(`BriefDrafter contract: ${name}`, () => {
    it("drafts a brief with an audience, problem, solution, tone and facts", async () => {
      const { drafter } = await make();
      const result = await drafter.draft(request);
      if (!result.ok) throw new Error(result.error.message);
      const { content } = result.value;
      for (const field of [content.audience, content.problem, content.solution, content.tone]) {
        expect(field.trim()).not.toBe("");
      }
      expect(content.facts.length).toBeGreaterThan(0);
    });

    it("backs every fact with a quote that appears on the site", async () => {
      const { drafter } = await make();
      const result = await drafter.draft(request);
      if (!result.ok) throw new Error(result.error.message);
      const { content, evidence } = result.value;
      expect(evidence.map((e) => e.statement)).toEqual(content.facts);
      for (const { quote } of evidence) expect(isGrounded(quote, corpus)).toBe(true);
    });

    it("reports a failure as a BriefDraftError result instead of throwing", async () => {
      const harness = await make();
      const failing = (await harness.givenFailure()) ?? request;
      const result = await harness.drafter.draft(failing);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).not.toBe("");
      expect(typeof result.error.retryable).toBe("boolean");
    });
  });
}
