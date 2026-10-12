import { describe, expect, it } from "vitest";
import { parseEvalCase, parseEvalConfig, scoreBrief, summarise, type EvalCase } from "./brief-eval";

const evalCase: EvalCase = {
  name: "acme",
  productName: "Acme Analytics",
  minFacts: 2,
  forbidden: ["SOC 2", "10,000"],
  site: {
    url: "https://acme.dev/",
    pages: [
      {
        url: "https://acme.dev/",
        title: "Acme",
        text: "Analytics for SaaS founders.\nStart a free 14-day trial.\nGDPR compliant.",
      },
    ],
  },
};

const content = {
  audience: "SaaS founders",
  problem: "Bloated dashboards",
  solution: "Five numbers a week",
  differentiators: [],
  tone: "Plain",
  facts: ["Free 14-day trial", "GDPR compliant"],
};
const evidence = [
  { statement: "Free 14-day trial", quote: "Start a free 14-day trial." },
  { statement: "GDPR compliant", quote: "GDPR compliant." },
];
const draft = { ok: true as const, value: { content, evidence, droppedClaims: ["SOC 2"] } };

describe("scoreBrief", () => {
  it("passes a complete, grounded brief with enough facts and no forbidden claims", () => {
    expect(scoreBrief(evalCase, draft)).toEqual({
      name: "acme",
      drafted: true,
      grounded: true,
      complete: true,
      enoughFacts: true,
      noForbiddenClaims: true,
      facts: 2,
      dropped: 1,
      passed: true,
      error: undefined,
    });
  });

  it("fails grounding when any quote is not on the site", () => {
    const bad = {
      ok: true as const,
      value: { ...draft.value, evidence: [{ statement: "x", quote: "Trusted by 10,000 teams" }] },
    };
    expect(scoreBrief(evalCase, bad)).toMatchObject({ grounded: false, passed: false });
  });

  it("fails when a core field is blank or there are too few facts", () => {
    const thin = {
      ok: true as const,
      value: { ...draft.value, content: { ...content, tone: " ", facts: ["Free 14-day trial"] } },
    };
    expect(scoreBrief(evalCase, thin)).toMatchObject({
      complete: false,
      enoughFacts: false,
      passed: false,
    });
  });

  it("fails when the brief repeats a claim the site never makes", () => {
    const invented = {
      ok: true as const,
      value: { ...draft.value, content: { ...content, solution: "SOC 2 certified analytics" } },
    };
    expect(scoreBrief(evalCase, invented)).toMatchObject({
      noForbiddenClaims: false,
      passed: false,
    });
  });

  it("fails a case whose draft errored", () => {
    const failed = {
      ok: false as const,
      error: { code: "unavailable" as const, message: "Overloaded", retryable: true },
    };
    expect(scoreBrief(evalCase, failed)).toMatchObject({
      drafted: false,
      passed: false,
      error: "unavailable: Overloaded",
    });
  });
});

describe("summarise", () => {
  it("meets the thresholds only when every case is grounded and complete", () => {
    const pass = scoreBrief(evalCase, draft);
    const fail = { ...pass, name: "other", complete: false, passed: false };
    expect(summarise([pass, pass])).toEqual({
      cases: 2,
      groundingRate: 1,
      passRate: 1,
      meetsThresholds: true,
    });
    expect(summarise([pass, fail])).toEqual({
      cases: 2,
      groundingRate: 1,
      passRate: 0.5,
      meetsThresholds: false,
    });
  });

  it("does not pass an empty eval set", () => {
    expect(summarise([]).meetsThresholds).toBe(false);
  });
});

describe("parseEvalCase", () => {
  it("accepts a well-formed case file", () => {
    expect(parseEvalCase(JSON.parse(JSON.stringify(evalCase)) as unknown)).toEqual({
      ok: true,
      value: evalCase,
    });
  });

  it("rejects a malformed case file", () => {
    expect(parseEvalCase({ name: "x" }).ok).toBe(false);
  });
});

describe("parseEvalConfig", () => {
  it("needs ANTHROPIC_API_KEY, explaining where to set it", () => {
    expect(parseEvalConfig({})).toEqual({
      ok: false,
      error:
        "ANTHROPIC_API_KEY is not set. Locally: export ANTHROPIC_API_KEY=… ; in CI: add it under Settings → Secrets and variables → Actions.",
    });
  });

  it("uses Claude Opus 5.5 unless ANTHROPIC_MODEL says otherwise", () => {
    expect(parseEvalConfig({ ANTHROPIC_API_KEY: "k" })).toEqual({
      ok: true,
      value: { apiKey: "k", model: "claude-opus-5-5" },
    });
    expect(
      parseEvalConfig({ ANTHROPIC_API_KEY: "k", ANTHROPIC_MODEL: "claude-sonnet-5-5" }),
    ).toEqual({ ok: true, value: { apiKey: "k", model: "claude-sonnet-5-5" } });
  });
});
