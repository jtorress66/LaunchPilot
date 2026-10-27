import { describe, expect, it } from "vitest";
import {
  contentLanguages,
  contentMarkets,
  defaultLocale,
  describeLocale,
  formatLocale,
  parseContentLocale,
} from "./content-locale";

describe("parseContentLocale", () => {
  it.each([
    ["pt-BR", { language: "pt", market: "BR" }],
    ["de-de", { language: "de", market: "DE" }],
    [" ja-JP ", { language: "ja", market: "JP" }],
    ["es_MX", { language: "es", market: "MX" }],
  ])("reads %s as a language and a market", (input, locale) => {
    expect(parseContentLocale(input)).toEqual({ ok: true, value: locale });
  });

  it.each([
    "",
    "pt",
    "BR",
    "xx-BR",
    "pt-XX",
    "pt-BR-x",
    "english-US",
    "pt-419",
    "en-EU",
    "en-UN",
    "en-ZZ",
    "en-XA",
  ])("refuses %j: a known language and a known country are both needed", (input) => {
    expect(parseContentLocale(input)).toMatchObject({
      ok: false,
      error: { code: "invalid_locale" },
    });
  });
});

describe("describeLocale", () => {
  it("names the language and market in English, for prompts and the UI", () => {
    expect(describeLocale({ language: "pt", market: "BR" })).toBe("Portuguese (Brazil)");
    expect(describeLocale({ language: "de", market: "DE" })).toBe("German (Germany)");
    expect(describeLocale(defaultLocale)).toBe("English (United States)");
  });
});

describe("formatLocale", () => {
  it("writes the tag the rest of the app stores: language-MARKET", () => {
    expect(formatLocale({ language: "pt", market: "BR" })).toBe("pt-BR");
    expect(formatLocale(defaultLocale)).toBe("en-US");
  });
});

describe("contentLanguages and contentMarkets", () => {
  it("list every language and country the runtime can name, and no groupings of countries", () => {
    expect(contentLanguages.length).toBeGreaterThan(150);
    expect(contentLanguages).toContain("pt");
    expect(contentMarkets.length).toBeGreaterThan(240);
    expect(contentMarkets).toContain("BR");
    for (const grouping of ["EU", "EZ", "UN", "QO", "XA", "XB", "ZZ"]) {
      expect(contentMarkets).not.toContain(grouping);
    }
  });
});
