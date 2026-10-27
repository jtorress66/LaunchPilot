import { parseContentLocale } from "@nuvantre/domain";
import { describe, expect, it } from "vitest";
import { languageOptions, marketOptions } from "./locale-options";

describe("locale options", () => {
  it("offers every language and country the runtime can name, sorted by name", () => {
    expect(languageOptions.length).toBeGreaterThan(150);
    expect(marketOptions.length).toBeGreaterThan(200);
    expect(languageOptions).toContainEqual({ code: "pt", name: "Portuguese" });
    expect(marketOptions).toContainEqual({ code: "BR", name: "Brazil" });
    const names = languageOptions.map((o) => o.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("offers only combinations the domain accepts", () => {
    const refused = [
      ...languageOptions.map((o) => `${o.code}-US`),
      ...marketOptions.map((o) => `en-${o.code}`),
    ].filter((tag) => !parseContentLocale(tag).ok);
    expect(refused).toEqual([]);
  });
});
