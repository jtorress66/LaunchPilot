import type { DraftRequest } from "@launchpilot/ports";
import { aBriefContent } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { TemplateArticleWriter } from "./template-article-writer";

const request: DraftRequest = {
  brief: aBriefContent(),
  channel: "blog",
  task: { kind: "seo_article", title: "Article: cookieless analytics" },
  keywords: ["cookieless analytics"],
};

const draft = async (req: DraftRequest = request) => {
  const result = await new TemplateArticleWriter().draft(req);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("TemplateArticleWriter", () => {
  it("titles the article after the target keyword", async () => {
    expect((await draft()).title).toBe(
      "Cookieless analytics: a practical guide for Solo SaaS founders",
    );
  });

  it("writes a Markdown article with an intro, several sections and a call to action", async () => {
    const { body } = await draft();
    expect(body.match(/^## /gm)?.length).toBeGreaterThanOrEqual(3);
    expect(body).toContain("Marketing takes time away from building");
    expect(body).toContain("Privacy-friendly analytics with weekly insights");
  });

  it("states only brief facts, verbatim, and cites them", async () => {
    const { body, citedFacts } = await draft();
    expect(citedFacts).toEqual(request.brief.facts);
    for (const fact of citedFacts) expect(body).toContain(fact);
  });

  it("is deterministic", async () => {
    expect(await draft()).toEqual(await draft());
  });

  it("falls back to the task title without a keyword and copes with no facts", async () => {
    const result = await draft({
      brief: aBriefContent({ facts: [] }),
      channel: request.channel,
      task: request.task,
    });
    expect(result.title).toMatch(/^Article: cookieless analytics/);
    expect(result.citedFacts).toEqual([]);
  });
});
