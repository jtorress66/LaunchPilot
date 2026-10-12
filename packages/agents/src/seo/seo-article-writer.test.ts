import type { DraftRequest } from "@launchpilot/ports";
import { aBriefContent, FakeLlmClient } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { SeoArticleWriter } from "./seo-article-writer";

const request: DraftRequest = {
  brief: aBriefContent(),
  channel: "blog",
  task: { kind: "seo_article", title: "Article: cookieless analytics" },
  keywords: ["cookieless analytics"],
};

const body = [
  "Cookieless analytics lets you measure growth without consent banners.",
  "## Why cookieless analytics matters",
  "Privacy rules keep tightening.",
  "## How to get started",
  "Acme offers a Free 14-day trial.",
].join("\n\n");

const reply = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: "Cookieless analytics: a practical guide for SaaS founders",
    body,
    citedFacts: ["Free 14-day trial"],
    ...overrides,
  });

const write = (llm: FakeLlmClient, req: DraftRequest = request) =>
  new SeoArticleWriter(llm).draft(req);

describe("SeoArticleWriter", () => {
  it("briefs the model with the keyword, the brief's facts, audience and tone", async () => {
    const llm = new FakeLlmClient().reply(reply());
    await write(llm);
    const prompt = llm.requests[0]?.messages.map((m) => m.content).join("\n") ?? "";
    expect(prompt).toContain("cookieless analytics");
    for (const fact of request.brief.facts) expect(prompt).toContain(fact);
    expect(prompt).toContain(request.brief.audience);
    expect(prompt).toContain(request.brief.tone);
  });

  it("keeps the system prompt identical across articles so it can be cached", async () => {
    const llm = new FakeLlmClient().reply(reply()).reply(reply());
    await write(llm);
    await write(llm, { ...request, keywords: ["saas analytics"] });
    const [first, second] = llm.requests;
    expect(first?.system).toBeTruthy();
    expect(first?.system).toBe(second?.system);
    expect(first?.system).not.toContain("cookieless");
  });

  it("asks for JSON matching the article schema", async () => {
    const llm = new FakeLlmClient().reply(reply());
    await write(llm);
    expect(llm.requests[0]?.responseFormat).toMatchObject({
      type: "json_schema",
      schema: { required: ["title", "body", "citedFacts"] },
    });
  });

  it("returns the drafted article", async () => {
    expect(await write(new FakeLlmClient().reply(reply()))).toEqual({
      ok: true,
      value: {
        title: "Cookieless analytics: a practical guide for SaaS founders",
        body,
        citedFacts: ["Free 14-day trial"],
      },
    });
  });

  it("keeps only cited facts that are in the brief", async () => {
    const llm = new FakeLlmClient().reply(
      reply({ citedFacts: ["Free 14-day trial", "Used by 10,000 teams"] }),
    );
    const result = await write(llm);
    expect(result.ok && result.value.citedFacts).toEqual(["Free 14-day trial"]);
  });

  it("fails when the article never mentions the target keyword", async () => {
    const llm = new FakeLlmClient().reply(
      reply({ title: "A guide", body: "## Intro\n\nNothing relevant here at all." }),
    );
    expect(await write(llm)).toMatchObject({ ok: false, error: { code: "generation_failed" } });
  });

  it.each([
    ["text that is not JSON", "Here is your article"],
    ["JSON with the wrong shape", JSON.stringify({ title: "x" })],
    ["an empty body", reply({ body: "   " })],
  ])("fails as generation_failed on %s", async (_, text) => {
    const result = await write(new FakeLlmClient().reply(text));
    expect(result.ok ? undefined : result.error.code).toBe("generation_failed");
  });

  it("fails as generation_failed when the article was cut off", async () => {
    const result = await write(new FakeLlmClient().replyTruncated(reply()));
    expect(result.ok ? undefined : result.error.code).toBe("generation_failed");
  });

  it.each([
    [{ code: "rate_limited", message: "Slow", retryable: true }, "unavailable", true],
    [{ code: "unavailable", message: "Down", retryable: true }, "unavailable", true],
    [{ code: "refused", message: "No", retryable: false }, "generation_failed", false],
    [{ code: "invalid_request", message: "Bad", retryable: false }, "generation_failed", false],
  ] as const)("maps model error %o to %s", async (error, code, retryable) => {
    const result = await write(new FakeLlmClient().fail(error));
    expect(result).toMatchObject({ ok: false, error: { code, retryable } });
  });

  it("writes about the task title when no keyword is given", async () => {
    const llm = new FakeLlmClient().reply(
      reply({ title: "Article: cookieless analytics explained" }),
    );
    const withoutKeywords: DraftRequest = {
      brief: request.brief,
      channel: request.channel,
      task: request.task,
    };
    const result = await write(llm, withoutKeywords);
    expect(result.ok).toBe(true);
    expect(llm.requests[0]?.messages[0]?.content).toContain("Article: cookieless analytics");
  });
});
