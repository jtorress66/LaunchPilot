import { describe, expect, it } from "vitest";
import listing from "../../test/dataforseo/recorded/locations-and-languages.json";
import { marketFor, parseMarkets } from "./markets";

describe("parseMarkets", () => {
  const markets = parseMarkets(listing);

  it.each([
    [{ language: "en", market: "US" }, 2840, "en"],
    [{ language: "es", market: "US" }, 2840, "es"],
    [{ language: "pt", market: "BR" }, 2076, "pt"],
    [{ language: "de", market: "DE" }, 2276, "de"],
    [{ language: "ja", market: "JP" }, 2392, "ja"],
  ])("finds Google keyword data for %o", (locale, location_code, language_code) => {
    expect(markets.ok && marketFor(markets.value, locale)).toEqual({
      location_code,
      language_code,
    });
  });

  it("has no market for a language the country does not offer, or a country it does not list", () => {
    expect(
      markets.ok && marketFor(markets.value, { language: "pt", market: "DE" }),
    ).toBeUndefined();
    expect(
      markets.ok && marketFor(markets.value, { language: "fr", market: "FR" }),
    ).toBeUndefined();
  });

  it("ignores languages that have no Google data", () => {
    const bingOnly = {
      ...listing,
      tasks: [
        {
          ...listing.tasks[0],
          result: [
            {
              location_code: 2250,
              country_iso_code: "FR",
              available_languages: [{ available_sources: ["bing"], language_code: "fr" }],
            },
          ],
        },
      ],
    };
    const parsed = parseMarkets(bingOnly);
    expect(parsed.ok && marketFor(parsed.value, { language: "fr", market: "FR" })).toBeUndefined();
  });

  it("reports a listing in an unexpected format", () => {
    expect(parseMarkets({ status_code: 20000, tasks: [{ result: "nope" }] }).ok).toBe(false);
    expect(parseMarkets({ status_code: 50000, status_message: "Down", tasks: [] }).ok).toBe(false);
  });
});
