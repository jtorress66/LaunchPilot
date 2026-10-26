import type { AnalysisRequest } from "@nuvantre/ports";
import { aBriefContent, aWeeklyReport, FakeLlmClient } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { AnalystAgent } from "./analyst-agent";

const request: AnalysisRequest = {
  product: { name: "Acme Analytics" },
  brief: aBriefContent(),
  report: aWeeklyReport(),
};

const notes = {
  summary: "Visitors rose 20% to 1,200 and search clicks rose 20% to 120.",
  highlights: ["/pricing had 210 visitors", '"cookieless analytics" brought 40 clicks'],
  suggestions: ["Write a follow-up post on cookieless analytics."],
};

const reply = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ ...notes, citedFacts: ["Free 14-day trial"], ...overrides });

const analyse = (llm: FakeLlmClient, r: AnalysisRequest = request) =>
  new AnalystAgent(llm).analyse(r);
const prompts = (llm: FakeLlmClient) =>
  llm.requests.map((r) => r.messages.map((m) => m.content).join("\n"));

describe("AnalystAgent", () => {
  it("shows the model the week, every figure as displayed, its change and the brief's facts", async () => {
    const llm = new FakeLlmClient().reply(reply());
    await analyse(llm);
    const [prompt = ""] = prompts(llm);
    expect(prompt).toContain("Product: Acme Analytics");
    expect(prompt).toContain("Week: 2026-W01 (29 Dec 2025 to 4 Jan 2026)");
    expect(prompt).toContain("Visitors: 1,200 (last week 1,000, +20%) from ga4");
    expect(prompt).toContain("Search CTR: 3.0% (new) from search_console");
    expect(prompt).toContain("/pricing: 210 visitors");
    expect(prompt).toContain('"cookieless analytics": 40 clicks, 900 impressions, position 3.1');
    expect(prompt).toContain("plausible: not connected");
    for (const fact of aBriefContent().facts) expect(prompt).toContain(fact);
  });

  it("keeps the system prompt free of per-product data and asks for the notes schema", async () => {
    const llm = new FakeLlmClient().reply(reply());
    await analyse(llm);
    expect(llm.requests[0]?.system).not.toContain("Acme");
    expect(llm.requests[0]?.system).toContain("Only state numbers that appear in the report");
    expect(llm.requests[0]?.responseFormat).toMatchObject({
      type: "json_schema",
      schema: { required: ["summary", "highlights", "suggestions", "citedFacts"] },
    });
  });

  it("returns the notes, citing only brief facts", async () => {
    const llm = new FakeLlmClient().reply(
      reply({ citedFacts: ["Free 14-day trial", "Used by 10,000 teams"] }),
    );
    expect(await analyse(llm)).toEqual({
      ok: true,
      value: { ...notes, citedFacts: ["Free 14-day trial"] },
    });
  });

  it("says there are no product facts when there is no approved brief, and cites none", async () => {
    const llm = new FakeLlmClient().reply(reply());
    const result = await analyse(llm, { ...request, brief: null });
    expect(prompts(llm)[0]).toContain("Approved product facts: none");
    expect(result.ok && result.value.citedFacts).toEqual([]);
  });

  it("asks once for a rewrite naming numbers the report does not contain", async () => {
    const llm = new FakeLlmClient()
      .reply(reply({ summary: "Signups hit 57, a 65% jump.", suggestions: [] }))
      .reply(reply());
    expect((await analyse(llm)).ok).toBe(true);
    const rewrite = llm.requests[1]?.messages.at(-1)?.content ?? "";
    expect(rewrite).toContain("These numbers are not in the report: 57, 65.");
    expect(rewrite).toContain("Give 1 to 3 suggestions.");
  });

  it("fails when the rewrite still breaks the rules", async () => {
    const bad = reply({ summary: "Signups hit 57." });
    const llm = new FakeLlmClient().reply(bad).reply(bad);
    expect(await analyse(llm)).toMatchObject({
      ok: false,
      error: { code: "analysis_failed", message: expect.stringContaining("57") as unknown },
    });
  });

  it.each([
    ["text that is not JSON", "Visitors went up."],
    ["JSON in the wrong shape", JSON.stringify({ summary: 1 })],
  ])("fails on %s", async (_case, text) => {
    const llm = new FakeLlmClient().reply(text);
    expect(await analyse(llm)).toMatchObject({ ok: false, error: { code: "analysis_failed" } });
  });

  it("fails when the answer is cut off", async () => {
    const llm = new FakeLlmClient().replyTruncated(reply());
    expect(await analyse(llm)).toMatchObject({ ok: false, error: { code: "analysis_failed" } });
  });

  it.each([
    ["rate_limited", "unavailable", true],
    ["unavailable", "unavailable", true],
    ["refused", "analysis_failed", false],
  ] as const)("maps a model %s error to %s", async (code, mapped, retryable) => {
    const llm = new FakeLlmClient().fail({ code, message: "Model error", retryable });
    expect(await analyse(llm)).toMatchObject({ ok: false, error: { code: mapped, retryable } });
  });
});
