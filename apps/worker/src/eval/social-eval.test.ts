import { describe, expect, it } from "vitest";
import { parseSocialEvalCase, scorePost, summarisePosts, type SocialEvalCase } from "./social-eval";

const evalCase: SocialEvalCase = {
  name: "acme",
  forbidden: ["SOC 2", "10,000 customers"],
  brief: {
    audience: "SaaS founders",
    problem: "Bloated dashboards",
    solution: "Five numbers a week",
    differentiators: ["No cookies"],
    tone: "Plain",
    facts: ["Free 14-day trial", "GDPR compliant"],
  },
  angles: [
    { channel: "x", angle: "Why it matters: No cookies" },
    { channel: "linkedin", angle: "New article: Guide", link: "https://blog.acme.dev/guide" },
  ],
};

const [xAngle, linkedinAngle] = evalCase.angles;
if (!xAngle || !linkedinAngle) throw new Error("fixture angles missing");

const post = (body: string, citedFacts: readonly string[] = ["Free 14-day trial"]) => ({
  ok: true as const,
  value: { title: "t", body, citedFacts },
});

describe("scorePost", () => {
  it("passes a short X post that cites only brief facts", () => {
    expect(
      scorePost(evalCase, xAngle, post("No cookies, no banner. Free 14-day trial. #analytics")),
    ).toMatchObject({
      name: "acme/x",
      drafted: true,
      withinLimit: true,
      citesOnlyBriefFacts: true,
      noForbiddenClaims: true,
      fewHashtags: true,
      includesLink: true,
      passed: true,
    });
  });

  it.each([
    ["over the X limit", post("a".repeat(281)), "withinLimit"],
    ["a cited fact the brief lacks", post("Hi", ["Used by 10,000 teams"]), "citesOnlyBriefFacts"],
    ["a forbidden claim", post("We are SOC 2 certified"), "noForbiddenClaims"],
    ["three hashtags on X", post("Hi #a #b #c"), "fewHashtags"],
  ] as const)("fails an X post %s", (_case, result, check) => {
    const score = scorePost(evalCase, xAngle, result);
    expect(score[check]).toBe(false);
    expect(score.passed).toBe(false);
  });

  it("requires the link when the angle has one, and allows LinkedIn's longer limit", () => {
    const long = "word ".repeat(100);
    expect(
      scorePost(evalCase, linkedinAngle, post(`${long} https://blog.acme.dev/guide`)).passed,
    ).toBe(true);
    expect(scorePost(evalCase, linkedinAngle, post(long)).includesLink).toBe(false);
  });

  it("fails a post whose draft errored", () => {
    expect(
      scorePost(evalCase, xAngle, {
        ok: false,
        error: { code: "generation_failed", message: "Too long", retryable: false },
      }),
    ).toMatchObject({ drafted: false, passed: false, error: "generation_failed: Too long" });
  });
});

describe("summarisePosts", () => {
  it("meets the thresholds only when every post passes", () => {
    const pass = scorePost(evalCase, xAngle, post("Fine."));
    expect(summarisePosts([pass])).toEqual({ posts: 1, passRate: 1, meetsThresholds: true });
    expect(summarisePosts([pass, { ...pass, passed: false }]).meetsThresholds).toBe(false);
    expect(summarisePosts([]).meetsThresholds).toBe(false);
  });
});

describe("parseSocialEvalCase", () => {
  it("accepts a well-formed case and rejects a malformed one", () => {
    expect(parseSocialEvalCase(JSON.parse(JSON.stringify(evalCase)) as unknown)).toEqual({
      ok: true,
      value: evalCase,
    });
    expect(parseSocialEvalCase({ name: "x", angles: [{ channel: "tiktok" }] }).ok).toBe(false);
  });
});
