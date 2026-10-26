import { isGrounded } from "@nuvantre/domain";
import type { CrawledSite } from "@nuvantre/ports";
import { briefDrafterContractSite as site } from "@nuvantre/testing/contracts";
import { describe, expect, it } from "vitest";
import { ExtractiveBriefDrafter } from "./extractive-brief-drafter";

const drafter = new ExtractiveBriefDrafter();
const corpus = site.pages.map((p) => `${p.title}\n${p.text}`).join("\n");

const draft = async (s: CrawledSite = site) => {
  const result = await drafter.draft({ productName: "Acme Analytics", site: s });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("ExtractiveBriefDrafter", () => {
  it("takes the audience from who the homepage says the product is for", async () => {
    expect((await draft()).content.audience).toBe("SaaS founders");
  });

  it("takes the problem from a sentence describing a pain", async () => {
    expect((await draft()).content.problem).toBe(
      "Founders waste hours in bloated dashboards that track everything but answer nothing.",
    );
  });

  it("takes the solution from the homepage's opening line", async () => {
    expect((await draft()).content.solution).toBe("Privacy-friendly analytics for SaaS founders.");
  });

  it("quotes concrete claims such as numbers, pricing and compliance as facts", async () => {
    const { content, evidence } = await draft();
    expect(content.facts).toEqual(
      expect.arrayContaining([
        "Start with a free 14-day trial.",
        "Acme is GDPR compliant and never uses cookies.",
      ]) as unknown,
    );
    for (const { quote } of evidence) expect(isGrounded(quote, corpus)).toBe(true);
    expect(evidence.map((e) => e.statement)).toEqual(content.facts);
  });

  it("never drops claims because it only copies sentences from the site", async () => {
    expect((await draft()).droppedClaims).toEqual([]);
  });

  it("falls back to generic wording when the site has no audience or pain sentence", async () => {
    const plain: CrawledSite = {
      url: site.url,
      pages: [{ url: site.url, title: "Widget", text: "Widget syncs your files. It costs $9." }],
    };
    const { content } = await draft(plain);
    expect(content.audience).toBe("People interested in Acme Analytics");
    expect(content.problem).not.toBe("");
    expect(content.facts).toEqual(["It costs $9."]);
  });

  it("fails as generation_failed when the site has no readable text", async () => {
    const empty: CrawledSite = { url: site.url, pages: [{ url: site.url, title: "", text: " " }] };
    const result = await drafter.draft({ productName: "Acme", site: empty });
    expect(result.ok ? undefined : result.error).toMatchObject({
      code: "generation_failed",
      retryable: false,
    });
  });
});
