import { describe, expect, it } from "vitest";
import { SeedKeywordProvider } from "./seed-keyword-provider";

const suggest = (seeds: string[], limit = 10) =>
  new SeedKeywordProvider().suggest({ seeds, locale: { language: "en", market: "US" }, limit });

describe("SeedKeywordProvider", () => {
  it("expands each seed into common question and comparison phrases, deterministically", async () => {
    const result = await suggest(["privacy analytics"], 4);
    expect(result).toEqual({
      ok: true,
      value: [
        { keyword: "privacy analytics", monthlySearches: 100, difficulty: 30 },
        { keyword: "what is privacy analytics", monthlySearches: 90, difficulty: 25 },
        { keyword: "privacy analytics for small business", monthlySearches: 80, difficulty: 20 },
        { keyword: "best privacy analytics tools", monthlySearches: 70, difficulty: 35 },
      ],
    });
    expect(await suggest(["privacy analytics"], 4)).toEqual(result);
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
