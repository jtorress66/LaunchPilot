import { rankKeywordOpportunities } from "@nuvantre/domain";
import { describe, expect, it } from "vitest";
import { SeedKeywordProvider } from "./seed-keyword-provider";

const suggest = (seeds: string[], limit = 10) =>
  new SeedKeywordProvider().suggest({ seeds, locale: { language: "en", market: "US" }, limit });

describe("SeedKeywordProvider", () => {
  it("expands each seed into common question and guide phrases, deterministically", async () => {
    const result = await suggest(["privacy analytics"], 4);
    expect(result).toEqual({
      ok: true,
      value: [
        { keyword: "privacy analytics", monthlySearches: 100, difficulty: 30 },
        { keyword: "what is privacy analytics", monthlySearches: 90, difficulty: 35 },
        { keyword: "privacy analytics guide", monthlySearches: 80, difficulty: 30 },
        { keyword: "privacy analytics examples", monthlySearches: 70, difficulty: 30 },
      ],
    });
    expect(await suggest(["privacy analytics"], 4)).toEqual(result);
  });

  it("assumes nothing about the audience, so the founder's own phrase ranks first", async () => {
    const result = await suggest(["lesson planning", "digital gradebook"], 20);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.map((i) => i.keyword).join(" ")).not.toMatch(/business|tools/);
    const best = rankKeywordOpportunities(result.value, { max: 2 }).map((i) => i.keyword);
    expect(best).toEqual(["lesson planning", "digital gradebook"]);
  });

  it("trims and lowercases seeds and skips blanks", async () => {
    const result = await suggest(["  Privacy Analytics ", " "], 1);
    expect(result.ok && result.value.map((i) => i.keyword)).toEqual(["privacy analytics"]);
  });

  it("refuses an empty list of seeds", async () => {
    expect(await suggest([" "])).toMatchObject({ ok: false, error: { code: "invalid_request" } });
  });

  it("keeps to the founder's own phrases outside English, where its English patterns would not fit", async () => {
    const result = await new SeedKeywordProvider().suggest({
      seeds: ["Análise sem cookies"],
      locale: { language: "pt", market: "BR" },
      limit: 10,
    });
    expect(result).toEqual({
      ok: true,
      value: [{ keyword: "análise sem cookies", monthlySearches: 100, difficulty: 30 }],
    });
  });
});
