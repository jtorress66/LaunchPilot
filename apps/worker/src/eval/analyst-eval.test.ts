import type { Analysis } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";
import {
  parseAnalystEvalCase,
  reportOf,
  scoreAnalysis,
  summariseAnalyses,
  type AnalystEvalCase,
} from "./analyst-eval";

const snapshot = (source: string, from: string, to: string, values: Record<string, number>) => ({
  source,
  from,
  to,
  values,
  topPages: [{ url: "/pricing", visitors: 210 }],
  topQueries: [{ query: "cookieless analytics", clicks: 40, impressions: 900, position: 3.1 }],
});

const json = {
  name: "acme",
  product: { name: "Acme" },
  forbidden: ["signups", "revenue"],
  summaryMentions: ["search clicks", "clicks"],
  brief: {
    audience: "SaaS founders",
    problem: "Bloated dashboards",
    solution: "Five numbers a week",
    differentiators: ["No cookies"],
    tone: "Plain",
    facts: ["Free 14-day trial"],
  },
  week: { start: "2026-10-12T00:00:00.000Z", end: "2026-10-19T00:00:00.000Z" },
  results: [
    {
      source: "search_console",
      outcome: {
        kind: "ok",
        current: snapshot(
          "search_console",
          "2026-10-12T00:00:00.000Z",
          "2026-10-19T00:00:00.000Z",
          {
            search_clicks: 150,
          },
        ),
        previous: snapshot(
          "search_console",
          "2026-10-05T00:00:00.000Z",
          "2026-10-12T00:00:00.000Z",
          {
            search_clicks: 100,
          },
        ),
      },
    },
    { source: "plausible", outcome: { kind: "not_connected" } },
  ],
};

const parsed = parseAnalystEvalCase(json);
if (!parsed.ok) throw new Error(parsed.error);
const evalCase: AnalystEvalCase = parsed.value;

const analysis = (overrides: Partial<Analysis> = {}) => ({
  ok: true as const,
  value: {
    summary: "Search clicks rose 50% to 150.",
    highlights: ['"cookieless analytics" brought 40 clicks.'],
    suggestions: ['Write about "cookieless analytics".'],
    citedFacts: [],
    ...overrides,
  },
});

describe("reportOf", () => {
  it("builds the report the analyst reads from the recorded sources", () => {
    expect(reportOf(evalCase)).toMatchObject({
      weekKey: "2026-W42",
      metrics: [{ name: "search_clicks", value: 150, previous: 100, change: 0.5 }],
      sources: [
        { source: "search_console", status: "ok" },
        { source: "plausible", status: "not_connected" },
      ],
    });
  });
});

describe("scoreAnalysis", () => {
  it("passes notes that use only the report's numbers and lead with the biggest change", () => {
    expect(scoreAnalysis(evalCase, reportOf(evalCase), analysis())).toMatchObject({
      name: "acme",
      analysed: true,
      numbersFromReport: true,
      citesOnlyBriefFacts: true,
      noForbiddenClaims: true,
      noHype: true,
      suggestionCount: true,
      namesBiggestChange: true,
      unknownNumbers: [],
      passed: true,
    });
  });

  it.each([
    [
      "a number not in the report",
      { summary: "Search clicks rose 50% to 150 and 37 signed up." },
      "numbersFromReport",
    ],
    ["a fact not in the brief", { citedFacts: ["SOC 2 certified"] }, "citesOnlyBriefFacts"],
    [
      "an invented cause",
      { summary: "Search clicks rose 50% thanks to revenue growth." },
      "noForbiddenClaims",
    ],
    ["hype", { summary: "Search clicks skyrocketed 50%!" }, "noHype"],
    ["no suggestions", { suggestions: [] }, "suggestionCount"],
    ["four suggestions", { suggestions: ["a", "b", "c", "d"] }, "suggestionCount"],
    ["a summary that skips the biggest change", { summary: "A quiet week." }, "namesBiggestChange"],
  ] as const)("fails notes with %s", (_case, overrides, check) => {
    const score = scoreAnalysis(evalCase, reportOf(evalCase), analysis(overrides));
    expect(score[check]).toBe(false);
    expect(score.passed).toBe(false);
  });

  it("names the unknown numbers so a failure is easy to read", () => {
    const score = scoreAnalysis(
      evalCase,
      reportOf(evalCase),
      analysis({ summary: "Search clicks rose 50%; 37 signed up." }),
    );
    expect(score.unknownNumbers).toEqual(["37"]);
  });

  it("fails an analysis that errored", () => {
    expect(
      scoreAnalysis(evalCase, reportOf(evalCase), {
        ok: false,
        error: { code: "analysis_failed", message: "Still wrong", retryable: false },
      }),
    ).toMatchObject({ analysed: false, passed: false, error: "analysis_failed: Still wrong" });
  });
});

describe("summariseAnalyses", () => {
  it("meets the thresholds only when every report passes", () => {
    const pass = scoreAnalysis(evalCase, reportOf(evalCase), analysis());
    expect(summariseAnalyses([pass])).toEqual({ reports: 1, passRate: 1, meetsThresholds: true });
    expect(summariseAnalyses([pass, { ...pass, passed: false }]).meetsThresholds).toBe(false);
    expect(summariseAnalyses([]).meetsThresholds).toBe(false);
  });
});

describe("parseAnalystEvalCase", () => {
  it("rejects a case whose forbidden claim the brief makes, or with an unknown source outcome", () => {
    expect(parseAnalystEvalCase({ ...json, forbidden: ["14-day trial"] })).toEqual({
      ok: false,
      error: 'Forbidden claim "14-day trial" appears in the brief',
    });
    expect(
      parseAnalystEvalCase({ ...json, results: [{ source: "x", outcome: { kind: "maybe" } }] }).ok,
    ).toBe(false);
  });
});
