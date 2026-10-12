import { describe, expect, it } from "vitest";
import {
  byOpportunity,
  rankKeywordOpportunities,
  type KeywordMetrics,
} from "./keyword-opportunity";

const idea = (keyword: string, monthlySearches: number, difficulty: number): KeywordMetrics => ({
  keyword,
  monthlySearches,
  difficulty,
});

describe("rankKeywordOpportunities", () => {
  it("puts high-volume, low-difficulty keywords first", () => {
    const ranked = rankKeywordOpportunities(
      [
        idea("saas analytics", 1000, 50),
        idea("cookieless analytics", 500, 5),
        idea("tiny", 100, 0),
      ],
      { max: 3 },
    );
    expect(ranked.map((r) => r.keyword)).toEqual([
      "cookieless analytics",
      "saas analytics",
      "tiny",
    ]);
  });

  it("leaves out keywords that are too hard or barely searched", () => {
    const ranked = rankKeywordOpportunities(
      [idea("analytics", 90_000, 85), idea("acme analytics review", 5, 1), idea("ok", 50, 20)],
      { max: 5 },
    );
    expect(ranked.map((r) => r.keyword)).toEqual(["ok"]);
  });

  it("respects custom difficulty and volume limits", () => {
    const ranked = rankKeywordOpportunities([idea("hard", 1000, 70), idea("rare", 3, 1)], {
      max: 5,
      maxDifficulty: 80,
      minVolume: 1,
    });
    expect(ranked.map((r) => r.keyword)).toEqual(["hard", "rare"]);
  });

  it("drops duplicates that differ only in case or spacing, keeping the better one", () => {
    const ranked = rankKeywordOpportunities(
      [idea("SaaS  Analytics", 100, 40), idea("saas analytics", 900, 10)],
      { max: 5 },
    );
    expect(ranked).toEqual([idea("saas analytics", 900, 10)]);
  });

  it("keeps the input order for equal scores and stops at the maximum", () => {
    const ranked = rankKeywordOpportunities(
      [idea("a", 100, 10), idea("b", 100, 10), idea("c", 100, 10)],
      { max: 2 },
    );
    expect(ranked.map((r) => r.keyword)).toEqual(["a", "b"]);
  });

  it("ignores blank keywords", () => {
    expect(rankKeywordOpportunities([idea("  ", 1000, 1)], { max: 5 })).toEqual([]);
  });
});

describe("byOpportunity", () => {
  it("orders keywords best opportunity first, whatever order they were stored in", () => {
    const stored = [idea("b", 100, 40), idea("a", 900, 14), idea("c", 300, 20)];
    expect([...stored].sort(byOpportunity).map((i) => i.keyword)).toEqual(["a", "c", "b"]);
  });
});
