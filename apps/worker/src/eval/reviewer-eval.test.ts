import { TemplateReviewer } from "@launchpilot/agents";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReviewError, ReviewVerdict } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";
import {
  parseReviewerEvalCase,
  reviewRequestOf,
  scoreReview,
  summariseReviews,
  type ReviewerEvalCase,
} from "./reviewer-eval";

const json = {
  name: "acme",
  brief: {
    audience: "SaaS founders",
    problem: "Bloated dashboards",
    solution: "Five numbers a week",
    differentiators: ["No cookie banners needed"],
    tone: "Plain",
    facts: ["Free 14-day trial"],
  },
  drafts: [
    {
      label: "good",
      expected: "pass",
      channel: "x",
      title: "No banners",
      body: "No cookie banners needed. Free 14-day trial.",
    },
    {
      label: "invented-fact",
      expected: "needs_changes",
      channel: "linkedin",
      title: "Trusted",
      body: "Trusted by 5,000 teams.",
    },
    {
      label: "missing-link",
      expected: "needs_changes",
      channel: "x",
      title: "New article",
      body: "Read our new article.",
      link: "https://blog.acme.dev/cookieless",
    },
  ],
};

const parsed = parseReviewerEvalCase(json);
if (!parsed.ok) throw new Error(parsed.error);
const evalCase: ReviewerEvalCase = parsed.value;
const [good, invented, missingLink] = evalCase.drafts;
if (!good || !invented || !missingLink) throw new Error("fixture drafts missing");

const verdict = (
  decision: ReviewVerdict["decision"],
  issues: ReviewVerdict["issues"] = [],
): { ok: true; value: ReviewVerdict } => ({ ok: true, value: { decision, issues } });

describe("reviewRequestOf", () => {
  it("sends the draft with the case's brief and its required link", () => {
    expect(reviewRequestOf(evalCase, missingLink)).toEqual({
      brief: json.brief,
      channel: "x",
      title: "New article",
      body: "Read our new article.",
      link: "https://blog.acme.dev/cookieless",
    });
    expect(reviewRequestOf(evalCase, good)).not.toHaveProperty("link");
  });
});

describe("scoreReview", () => {
  it("passes when the verdict matches a good draft's label", () => {
    expect(scoreReview(evalCase, good, verdict("pass"))).toMatchObject({
      name: "acme/good",
      reviewed: true,
      matchesLabel: true,
      explainsBlockers: true,
      passed: true,
    });
  });

  it("passes when a bad draft is held back with a blocker that says why", () => {
    const score = scoreReview(
      evalCase,
      invented,
      verdict("needs_changes", [
        { severity: "blocker", message: "5,000 teams is not in the brief" },
      ]),
    );
    expect(score).toMatchObject({ matchesLabel: true, explainsBlockers: true, passed: true });
  });

  it.each([
    ["lets a bad draft through", invented, verdict("pass"), "matchesLabel"],
    [
      "holds back a good draft",
      good,
      verdict("needs_changes", [{ severity: "blocker", message: "Too short" }]),
      "matchesLabel",
    ],
    [
      "holds back a bad draft with only suggestions",
      missingLink,
      verdict("needs_changes", [{ severity: "suggestion", message: "Add the link" }]),
      "explainsBlockers",
    ],
  ] as const)("fails a reviewer that %s", (_case, draft, result, check) => {
    const score = scoreReview(evalCase, draft, result);
    expect(score[check]).toBe(false);
    expect(score.passed).toBe(false);
  });

  it("fails a review that errored", () => {
    const failed: { ok: false; error: ReviewError } = {
      ok: false,
      error: { code: "review_failed", message: "Bad JSON", retryable: false },
    };
    expect(scoreReview(evalCase, good, failed)).toMatchObject({
      reviewed: false,
      passed: false,
      error: "review_failed: Bad JSON",
    });
  });
});

describe("summariseReviews", () => {
  it("meets the thresholds only when every verdict matches its label", () => {
    const pass = scoreReview(evalCase, good, verdict("pass"));
    expect(summariseReviews([pass])).toEqual({ drafts: 1, passRate: 1, meetsThresholds: true });
    expect(summariseReviews([pass, { ...pass, passed: false }]).meetsThresholds).toBe(false);
    expect(summariseReviews([]).meetsThresholds).toBe(false);
  });
});

describe("parseReviewerEvalCase", () => {
  it("rejects a case with an unknown channel, label or no drafts", () => {
    expect(parseReviewerEvalCase({ ...json, drafts: [] }).ok).toBe(false);
    expect(
      parseReviewerEvalCase({ ...json, drafts: [{ ...json.drafts[0], channel: "myspace" }] }).ok,
    ).toBe(false);
    expect(
      parseReviewerEvalCase({ ...json, drafts: [{ ...json.drafts[0], expected: "maybe" }] }).ok,
    ).toBe(false);
  });
});

describe("the recorded reviewer cases", () => {
  it("parse, and the offline reviewer agrees with every label", async () => {
    const dir = join(import.meta.dirname, "../../../../evals/review/cases");
    const reviewer = new TemplateReviewer();
    const files = (await readdir(dir)).filter((file) => file.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const recorded = parseReviewerEvalCase(JSON.parse(await readFile(join(dir, file), "utf8")));
      if (!recorded.ok) throw new Error(`${file}: ${recorded.error}`);
      const labels = new Set(recorded.value.drafts.map((d) => d.expected));
      expect(labels).toEqual(new Set(["pass", "needs_changes"]));
      for (const draft of recorded.value.drafts) {
        const result = await reviewer.review(reviewRequestOf(recorded.value, draft));
        expect(scoreReview(recorded.value, draft, result), draft.label).toMatchObject({
          passed: true,
        });
      }
    }
  });
});
