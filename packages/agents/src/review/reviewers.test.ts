import type { ReviewRequest } from "@launchpilot/ports";
import { aBriefContent, FakeLlmClient } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { ReviewerAgent } from "./reviewer-agent";
import { TemplateReviewer } from "./template-reviewer";

const request: ReviewRequest = {
  brief: aBriefContent(),
  channel: "linkedin",
  title: "Why we built Acme",
  body: "Dashboards were eating our week, so we built Acme. Free 14-day trial.",
};
const overLimit = { ...request, channel: "x" as const, body: "a".repeat(300) };

describe("TemplateReviewer", () => {
  it("passes a clean draft and blocks one that breaks a rule", async () => {
    const reviewer = new TemplateReviewer();
    expect(await reviewer.review(request)).toEqual({
      ok: true,
      value: { decision: "pass", issues: [] },
    });
    expect(await reviewer.review(overLimit)).toMatchObject({
      ok: true,
      value: { decision: "needs_changes", issues: [{ severity: "blocker" }] },
    });
  });
});

const reply = (decision: string, issues: unknown[] = []) => JSON.stringify({ decision, issues });

describe("an empty draft", () => {
  it("cannot be reviewed", async () => {
    for (const reviewer of [new TemplateReviewer(), new ReviewerAgent(new FakeLlmClient())]) {
      expect(await reviewer.review({ ...request, body: " " })).toMatchObject({
        ok: false,
        error: { code: "review_failed", retryable: false },
      });
    }
  });
});

describe("ReviewerAgent", () => {
  it("blocks a draft that fails the deterministic checks without asking the model", async () => {
    const llm = new FakeLlmClient();
    const result = await new ReviewerAgent(llm).review(overLimit);
    expect(result).toMatchObject({ ok: true, value: { decision: "needs_changes" } });
    expect(llm.requests).toEqual([]);
  });

  it("shows the model the brief's facts, the channel and the draft", async () => {
    const llm = new FakeLlmClient().reply(reply("pass"));
    await new ReviewerAgent(llm).review(request);
    const prompt = llm.requests[0]?.messages[0]?.content ?? "";
    expect(prompt).toContain("Channel: linkedin");
    expect(prompt).toContain(request.body);
    for (const fact of request.brief.facts) expect(prompt).toContain(fact);
    expect(llm.requests[0]?.system).toContain("You review drafts");
    expect(llm.requests[0]?.system).not.toContain("Acme");
  });

  it("returns the model's verdict and issues", async () => {
    const issues = [{ severity: "suggestion", message: "Lead with the problem" }];
    const llm = new FakeLlmClient().reply(reply("pass", issues));
    expect(await new ReviewerAgent(llm).review(request)).toEqual({
      ok: true,
      value: { decision: "pass", issues },
    });
  });

  it("never passes a verdict whose issues include a blocker", async () => {
    const llm = new FakeLlmClient().reply(
      reply("pass", [{ severity: "blocker", message: "Claims an integration the brief lacks" }]),
    );
    expect(await new ReviewerAgent(llm).review(request)).toMatchObject({
      ok: true,
      value: { decision: "needs_changes" },
    });
  });

  it.each([
    ["text that is not JSON", "Looks fine."],
    ["JSON in the wrong shape", JSON.stringify({ decision: "maybe" })],
  ])("fails on %s", async (_case, text) => {
    const llm = new FakeLlmClient().reply(text);
    expect(await new ReviewerAgent(llm).review(request)).toMatchObject({
      ok: false,
      error: { code: "review_failed" },
    });
  });

  it("fails when the answer is cut off", async () => {
    const llm = new FakeLlmClient().replyTruncated(reply("pass"));
    expect(await new ReviewerAgent(llm).review(request)).toMatchObject({
      ok: false,
      error: { code: "review_failed" },
    });
  });

  it.each([
    ["rate_limited", "unavailable", true],
    ["refused", "review_failed", false],
  ] as const)("maps a model %s error to %s", async (code, mapped, retryable) => {
    const llm = new FakeLlmClient().fail({ code, message: "Model error", retryable });
    expect(await new ReviewerAgent(llm).review(request)).toMatchObject({
      ok: false,
      error: { code: mapped, retryable },
    });
  });
});
