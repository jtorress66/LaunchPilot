import { describe, expect, it } from "vitest";
import { dataForSeoLocation } from "./locales";

describe("dataForSeoLocation", () => {
  it.each([
    ["en-US", 2840, "en"],
    ["en-GB", 2826, "en"],
    ["en-CA", 2124, "en"],
    ["en-AU", 2036, "en"],
    ["de-DE", 2276, "de"],
    ["fr-FR", 2250, "fr"],
    ["es-ES", 2724, "es"],
  ])("maps %s to location %i and language %s", (locale, location_code, language_code) => {
    expect(dataForSeoLocation(locale)).toEqual({ location_code, language_code });
  });

  it("ignores case", () => {
    expect(dataForSeoLocation("EN-us")).toEqual({ location_code: 2840, language_code: "en" });
  });

  it("returns undefined for a locale it does not support", () => {
    expect(dataForSeoLocation("xx-YY")).toBeUndefined();
  });
});
