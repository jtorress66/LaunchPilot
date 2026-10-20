import { describe, expect, it } from "vitest";
import type { PostAngle } from "../social/post-angles";
import { validateWeekPlan, weeklyChannelCaps, type ProposedTask } from "./week-plan";

const keywords = [
  { keyword: "cookieless analytics", monthlySearches: 480, difficulty: 12 },
  { keyword: "gdpr analytics tool", monthlySearches: 320, difficulty: 18 },
  { keyword: "plausible alternative", monthlySearches: 210, difficulty: 25 },
];
const angles: PostAngle[] = [
  { channel: "x", angle: "Why it matters: No cookies", link: null },
  { channel: "x", angle: "Worth knowing: Free 14-day trial", link: null },
  { channel: "linkedin", angle: "The problem: Bloated dashboards", link: null },
];
const candidates = { keywords, angles };

const seo = (keyword: string, title = `Article: ${keyword}`): ProposedTask => ({
  kind: "seo_article",
  channel: "blog",
  title,
  rationale: "Ranks for a growing query",
  keyword,
});
const post = (channel: "x" | "linkedin", angle: string): ProposedTask => ({
  kind: "social_post",
  channel,
  title: angle,
  rationale: "Keeps the audience warm",
  angle,
});

describe("validateWeekPlan", () => {
  it("accepts tasks built from the offered candidates, attaching their full details", () => {
    const result = validateWeekPlan(
      [seo("Cookieless Analytics "), post("x", "Why it matters: No cookies")],
      { allowance: 10, candidates },
    );
    expect(result.dropped).toEqual([]);
    expect(result.accepted).toEqual([
      {
        kind: "seo_article",
        channel: "blog",
        title: "Article: Cookieless Analytics ",
        rationale: "Ranks for a growing query",
        seo: keywords[0],
      },
      {
        kind: "social_post",
        channel: "x",
        title: "Why it matters: No cookies",
        rationale: "Keeps the audience warm",
        angle: angles[0],
      },
    ]);
  });

  it.each([
    [
      "a launch task",
      { ...seo("cookieless analytics"), kind: "launch_submission" },
      "not_plannable",
    ],
    [
      "a draft-only channel",
      { ...post("x", "Why it matters: No cookies"), channel: "reddit" },
      "not_plannable",
    ],
    [
      "an article on a social channel",
      { ...seo("cookieless analytics"), channel: "x" },
      "not_plannable",
    ],
    ["a keyword nobody offered", seo("best analytics 2027"), "unknown_keyword"],
    ["an article without a keyword", { ...seo("x"), keyword: undefined }, "unknown_keyword"],
    ["an angle nobody offered", post("x", "We are #1"), "unknown_angle"],
    [
      "an angle offered for another channel",
      post("linkedin", "Why it matters: No cookies"),
      "unknown_angle",
    ],
  ] as const)("drops %s", (_case, task, reason) => {
    const result = validateWeekPlan([task], { allowance: 10, candidates });
    expect(result.accepted).toEqual([]);
    expect(result.dropped).toEqual([{ task, reason }]);
  });

  it("drops a repeated keyword or angle", () => {
    const result = validateWeekPlan(
      [
        seo("cookieless analytics"),
        seo("cookieless analytics", "Another take"),
        post("x", "Why it matters: No cookies"),
        post("x", "Why it matters: No cookies"),
      ],
      { allowance: 10, candidates },
    );
    expect(result.accepted).toHaveLength(2);
    expect(result.dropped.map((d) => d.reason)).toEqual(["duplicate", "duplicate"]);
  });

  it("caps each channel per week", () => {
    expect(weeklyChannelCaps).toEqual({ blog: 2, x: 3, linkedin: 2 });
    const result = validateWeekPlan(
      keywords.map((k) => seo(k.keyword)),
      {
        allowance: 10,
        candidates,
      },
    );
    expect(result.accepted).toHaveLength(2);
    expect(result.dropped).toEqual([
      { task: seo("plausible alternative"), reason: "channel_full" },
    ]);
  });

  it("keeps articles first when the monthly allowance runs short", () => {
    const result = validateWeekPlan(
      [
        post("x", "Why it matters: No cookies"),
        seo("cookieless analytics"),
        post("linkedin", "The problem: Bloated dashboards"),
      ],
      { allowance: 2, candidates },
    );
    expect(result.accepted.map((t) => t.channel)).toEqual(["blog", "x"]);
    expect(result.dropped).toEqual([
      { task: post("linkedin", "The problem: Bloated dashboards"), reason: "over_allowance" },
    ]);
  });

  it("plans nothing when the allowance is used up", () => {
    const result = validateWeekPlan([seo("cookieless analytics")], { allowance: 0, candidates });
    expect(result.accepted).toEqual([]);
    expect(result.dropped[0]?.reason).toBe("over_allowance");
  });
});
