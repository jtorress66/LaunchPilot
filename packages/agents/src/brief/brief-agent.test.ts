import type { BriefDraftRequest } from "@nuvantre/ports";
import { FakeLlmClient } from "@nuvantre/testing";
import { briefDrafterContractSite } from "@nuvantre/testing/contracts";
import { describe, expect, it } from "vitest";
import { BriefAgent } from "./brief-agent";

const request: BriefDraftRequest = {
  productName: "Acme Analytics",
  site: briefDrafterContractSite,
};

const reply = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    audience: "SaaS founders who want simple analytics",
    problem: "Bloated dashboards track everything but answer nothing",
    solution: "The five numbers that matter in one weekly email",
    differentiators: ["No cookie banners", "Two-minute setup"],
    tone: "Plain and confident",
    facts: [
      { statement: "Free 14-day trial", quote: "Start with a free 14-day trial." },
      { statement: "GDPR compliant", quote: "Acme is GDPR compliant" },
    ],
    ...overrides,
  });

const agentWith = (llm: FakeLlmClient) => new BriefAgent(llm);

describe("BriefAgent", () => {
  it("sends the product name and every crawled page to the model", async () => {
    const llm = new FakeLlmClient().reply(reply());
    await agentWith(llm).draft(request);
    const [sent] = llm.requests;
    const prompt = sent?.messages.map((m) => m.content).join("\n") ?? "";
    expect(prompt).toContain("Acme Analytics");
    for (const page of request.site.pages) {
      expect(prompt).toContain(page.url);
      expect(prompt).toContain(page.text);
    }
  });

  it("keeps the system prompt identical across products so it can be cached", async () => {
    const llm = new FakeLlmClient().reply(reply()).reply(reply());
    const agent = agentWith(llm);
    await agent.draft(request);
    await agent.draft({ ...request, productName: "Other" });
    const [first, second] = llm.requests;
    expect(first?.system).toBeTruthy();
    expect(first?.system).toBe(second?.system);
    expect(first?.system).not.toContain("Acme");
  });

  it("asks for JSON that matches the brief schema", async () => {
    const llm = new FakeLlmClient().reply(reply());
    await agentWith(llm).draft(request);
    const format = llm.requests[0]?.responseFormat;
    expect(format?.type).toBe("json_schema");
    expect(format?.schema).toMatchObject({
      type: "object",
      required: expect.arrayContaining(["audience", "problem", "solution", "facts"]) as unknown,
    });
  });

  it("turns the model's answer into a brief with evidence for every fact", async () => {
    const result = await agentWith(new FakeLlmClient().reply(reply())).draft(request);
    expect(result).toEqual({
      ok: true,
      value: {
        content: {
          audience: "SaaS founders who want simple analytics",
          problem: "Bloated dashboards track everything but answer nothing",
          solution: "The five numbers that matter in one weekly email",
          differentiators: ["No cookie banners", "Two-minute setup"],
          tone: "Plain and confident",
          facts: ["Free 14-day trial", "GDPR compliant"],
        },
        evidence: [
          { statement: "Free 14-day trial", quote: "Start with a free 14-day trial." },
          { statement: "GDPR compliant", quote: "Acme is GDPR compliant" },
        ],
        droppedClaims: [],
      },
    });
  });

  it("drops facts the site does not support and reports them", async () => {
    const llm = new FakeLlmClient().reply(
      reply({
        facts: [
          { statement: "Free 14-day trial", quote: "free 14-day trial" },
          { statement: "Trusted by 10,000 teams", quote: "Trusted by 10,000 teams" },
        ],
      }),
    );
    const result = await agentWith(llm).draft(request);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.content.facts).toEqual(["Free 14-day trial"]);
    expect(result.value.droppedClaims).toEqual(["Trusted by 10,000 teams"]);
  });

  it("fails as ungrounded when no fact is supported by the site", async () => {
    const llm = new FakeLlmClient().reply(
      reply({ facts: [{ statement: "SOC 2 certified", quote: "SOC 2 Type II certified" }] }),
    );
    const result = await agentWith(llm).draft(request);
    expect(result.ok ? undefined : result.error).toMatchObject({
      code: "ungrounded",
      retryable: true,
    });
  });

  it.each([
    ["text that is not JSON", "Here is your brief!"],
    ["JSON with the wrong shape", JSON.stringify({ audience: "x" })],
    ["a blank core field", reply({ problem: "   " })],
  ])("fails as generation_failed on %s", async (_, text) => {
    const result = await agentWith(new FakeLlmClient().reply(text)).draft(request);
    expect(result.ok ? undefined : result.error.code).toBe("generation_failed");
  });

  it("fails as generation_failed when the answer was cut off", async () => {
    const llm = new FakeLlmClient();
    llm.replyTruncated(reply());
    const result = await agentWith(llm).draft(request);
    expect(result.ok ? undefined : result.error.code).toBe("generation_failed");
  });

  it.each([
    { code: "rate_limited", message: "Slow down", retryable: true },
    { code: "unavailable", message: "Overloaded", retryable: true },
    { code: "refused", message: "Declined", retryable: false },
  ] as const)("passes the model error $code through unchanged", async (error) => {
    const result = await agentWith(new FakeLlmClient().fail(error)).draft(request);
    expect(result).toEqual({ ok: false, error });
  });
});
