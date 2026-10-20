import { describe, expect, it } from "vitest";
import { aBriefContent } from "../fixtures/entities";
import { aPlanRequest } from "../fixtures/orchestration";
import { FakeCampaignPlanner } from "./fake-campaign-planner";
import { FakeContentDrafter } from "./fake-content-drafter";
import { FakeContentReviewer } from "./fake-content-reviewer";

const brief = aBriefContent();

describe("agent fakes", () => {
  it("FakeContentDrafter returns a scripted draft and records the request", async () => {
    const drafter = new FakeContentDrafter();
    const draft = { title: "Custom", body: "Scripted body", citedFacts: [] };
    drafter.respondWith(draft);
    const request = {
      brief,
      channel: "x" as const,
      task: { kind: "social_post" as const, title: "Post" },
    };
    expect(await drafter.draft(request)).toEqual({ ok: true, value: draft });
    expect(drafter.requests).toEqual([request]);
  });

  it("FakeContentReviewer returns a scripted verdict", async () => {
    const reviewer = new FakeContentReviewer();
    const verdict = {
      decision: "needs_changes" as const,
      issues: [{ severity: "blocker" as const, message: "Claim not in brief" }],
    };
    reviewer.respondWith(verdict);
    const result = await reviewer.review({ brief, channel: "blog", title: "T", body: "B" });
    expect(result).toEqual({ ok: true, value: verdict });
  });

  it("FakeCampaignPlanner returns a scripted plan", async () => {
    const planner = new FakeCampaignPlanner();
    const plan = { name: "Scripted", goal: "Goal", tasks: [] };
    planner.respondWith(plan);
    expect(await planner.plan(aPlanRequest({ brief }))).toEqual({ ok: true, value: plan });
  });

  it("FakeContentReviewer answers scripted verdicts once each, then its default", async () => {
    const reviewer = new FakeContentReviewer();
    const needsChanges = {
      decision: "needs_changes" as const,
      issues: [{ severity: "suggestion" as const, message: "Shorter" }],
    };
    reviewer.respondOnce(needsChanges);
    const request = { brief, channel: "x" as const, title: "T", body: "B" };
    expect(await reviewer.review(request)).toEqual({ ok: true, value: needsChanges });
    expect(await reviewer.review(request)).toEqual({
      ok: true,
      value: { decision: "pass", issues: [] },
    });
  });
});
