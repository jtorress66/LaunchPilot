import { TemplateStrategist } from "@launchpilot/agents";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CampaignPlan, PlanError } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";
import {
  parseStrategistEvalCase,
  planRequestOf,
  scorePlan,
  summarisePlans,
  type StrategistEvalCase,
} from "./strategist-eval";

const brief = {
  audience: "SaaS founders",
  problem: "Bloated dashboards",
  solution: "Five numbers a week",
  differentiators: ["No cookie banners needed"],
  tone: "Plain",
  facts: ["Free 14-day trial"],
};

const searchConsole = (from: string, to: string, clicks: number) => ({
  source: "search_console",
  from,
  to,
  values: { search_clicks: clicks },
  topPages: [],
  topQueries: [{ query: "cookieless analytics", clicks: 40, impressions: 900, position: 3.1 }],
});

const json = {
  name: "acme",
  product: { name: "Acme" },
  brief,
  week: { start: "2026-10-19T00:00:00.000Z", end: "2026-10-26T00:00:00.000Z" },
  lastWeek: {
    week: { start: "2026-10-12T00:00:00.000Z", end: "2026-10-19T00:00:00.000Z" },
    results: [
      {
        source: "search_console",
        outcome: {
          kind: "ok",
          current: searchConsole("2026-10-12T00:00:00.000Z", "2026-10-19T00:00:00.000Z", 150),
          previous: searchConsole("2026-10-05T00:00:00.000Z", "2026-10-12T00:00:00.000Z", 100),
        },
      },
    ],
  },
  allowance: 4,
  keywords: [
    { keyword: "cookieless analytics", monthlySearches: 480, difficulty: 12 },
    { keyword: "gdpr analytics tool", monthlySearches: 320, difficulty: 18 },
  ],
};

const parsed = parseStrategistEvalCase(json);
if (!parsed.ok) throw new Error(parsed.error);
const evalCase: StrategistEvalCase = parsed.value;
const request = planRequestOf(evalCase);
const xAngles = request.candidates.angles.filter((a) => a.channel === "x").map((a) => a.angle);
const xAngle = xAngles[0] ?? "";

const plan = (overrides: Partial<CampaignPlan> = {}) => ({
  ok: true as const,
  value: {
    name: "Week of 19 Oct",
    goal: "Build on last week's 150 search clicks",
    tasks: [
      {
        kind: "seo_article" as const,
        channel: "blog" as const,
        title: "Cookieless analytics, explained",
        rationale: "480 searches a month at difficulty 12; it already brought 40 clicks.",
        keyword: "cookieless analytics",
      },
      {
        kind: "social_post" as const,
        channel: "x" as const,
        title: "No cookie banners",
        rationale: "Leads with the brief's strongest differentiator.",
        angle: xAngle,
      },
    ],
    ...overrides,
  },
});

describe("planRequestOf", () => {
  it("offers the recorded report, the keywords and the angles the loop would offer", () => {
    expect(request).toMatchObject({
      product: { name: "Acme" },
      allowance: 4,
      lastWeek: { weekKey: "2026-W42", metrics: [{ name: "search_clicks", value: 150 }] },
      candidates: { keywords: json.keywords },
    });
    expect(new Set(request.candidates.angles.map((a) => a.channel))).toEqual(
      new Set(["x", "linkedin"]),
    );
  });

  it("has no report in a product's first week", () => {
    const first = parseStrategistEvalCase({ ...json, lastWeek: null });
    if (!first.ok) throw new Error(first.error);
    expect(planRequestOf(first.value).lastWeek).toBeNull();
  });
});

describe("scorePlan", () => {
  it("passes a grounded plan within the limits that cites only known figures", () => {
    expect(scorePlan(evalCase, request, plan())).toMatchObject({
      name: "acme",
      planned: true,
      grounded: true,
      withinLimits: true,
      figuresGrounded: true,
      hasGoal: true,
      noHype: true,
      mixesArticlesAndPosts: true,
      unknownFigures: [],
      passed: true,
    });
  });

  const article = plan().value.tasks[0];
  const post = plan().value.tasks[1];
  it.each([
    [
      "an invented keyword",
      { tasks: [{ ...article, keyword: "web analytics" }, post] },
      "grounded",
    ],
    ["an invented angle", { tasks: [article, { ...post, angle: "Hot take" }] }, "grounded"],
    ["a community post", { tasks: [article, { ...post, channel: "reddit" }] }, "grounded"],
    [
      "more tasks than the allowance",
      {
        tasks: [
          article,
          { ...article, keyword: "gdpr analytics tool" },
          ...xAngles.map((angle) => ({ ...post, angle })),
        ],
      },
      "withinLimits",
    ],
    ["a figure in no source", { goal: "Reach 5,000 visitors" }, "figuresGrounded"],
    ["no goal", { goal: " " }, "hasGoal"],
    ["hype", { goal: "A game-changing week" }, "noHype"],
    ["articles only", { tasks: [article] }, "mixesArticlesAndPosts"],
  ] as const)("fails a plan with %s", (_case, overrides, check) => {
    const score = scorePlan(evalCase, request, plan(overrides as Partial<CampaignPlan>));
    expect(score[check]).toBe(false);
    expect(score.passed).toBe(false);
  });

  it("accepts figures the brief states, such as a post titled after a brief fact", () => {
    const score = scorePlan(evalCase, request, plan({ name: "Lead with the 14-day trial" }));
    expect(score.figuresGrounded).toBe(true);
  });

  it("accepts the week's own dates in a first week with no report", () => {
    const first = parseStrategistEvalCase({ ...json, lastWeek: null });
    if (!first.ok) throw new Error(first.error);
    const firstRequest = planRequestOf(first.value);
    const score = scorePlan(
      first.value,
      firstRequest,
      plan({
        name: "Week of 2026-10-19",
        goal: "Grow organic reach",
        tasks: plan().value.tasks.map((t) => ({ ...t, rationale: "Fits the audience" })),
      }),
    );
    expect(score.unknownFigures).toEqual([]);
  });

  it("names the unknown figures so a failure is easy to read", () => {
    expect(
      scorePlan(evalCase, request, plan({ goal: "Reach 5,000 visitors" })).unknownFigures,
    ).toEqual(["5,000"]);
  });

  it("fails a plan that errored", () => {
    const failed: { ok: false; error: PlanError } = {
      ok: false,
      error: { code: "planning_failed", message: "Still wrong", retryable: false },
    };
    expect(scorePlan(evalCase, request, failed)).toMatchObject({
      planned: false,
      passed: false,
      error: "planning_failed: Still wrong",
    });
  });
});

describe("summarisePlans", () => {
  it("meets the thresholds only when every plan passes", () => {
    const pass = scorePlan(evalCase, request, plan());
    expect(summarisePlans([pass])).toEqual({ plans: 1, passRate: 1, meetsThresholds: true });
    expect(summarisePlans([pass, { ...pass, passed: false }]).meetsThresholds).toBe(false);
    expect(summarisePlans([]).meetsThresholds).toBe(false);
  });
});

describe("parseStrategistEvalCase", () => {
  it("rejects a case with no keywords or no allowance", () => {
    expect(parseStrategistEvalCase({ ...json, keywords: [] }).ok).toBe(false);
    expect(parseStrategistEvalCase({ ...json, allowance: 0 }).ok).toBe(false);
  });
});

describe("the recorded strategist cases", () => {
  it("parse, and the offline strategist's plan passes every one", async () => {
    const dir = join(import.meta.dirname, "../../../../evals/strategy/cases");
    const strategist = new TemplateStrategist();
    const files = (await readdir(dir)).filter((file) => file.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const file of files) {
      const recorded = parseStrategistEvalCase(JSON.parse(await readFile(join(dir, file), "utf8")));
      if (!recorded.ok) throw new Error(`${file}: ${recorded.error}`);
      const recordedRequest = planRequestOf(recorded.value);
      const score = scorePlan(
        recorded.value,
        recordedRequest,
        await strategist.plan(recordedRequest),
      );
      expect({ file, passed: score.passed }).toEqual({ file, passed: true });
    }
  });
});
