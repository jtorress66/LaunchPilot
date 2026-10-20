import { describe, expect, it } from "vitest";
import { parseSeedDirectories } from "./parse-seed";

const entry = {
  slug: "betalist",
  name: "BetaList",
  kind: "launch_platform",
  channel: "directory",
  homepageUrl: "https://betalist.com",
  submitUrl: "https://betalist.com/submit",
  pricing: "freemium",
  priceNote: null,
  topics: ["startups"],
  limits: {},
  checkedAt: "2026-10-15",
  evidence: "https://betalist.com/submit",
};

describe("parseSeedDirectories", () => {
  it("parses curated entries, ignoring research notes such as evidence", () => {
    const result = parseSeedDirectories([entry]);
    expect(result.ok && result.value.map((d) => d.slug)).toEqual(["betalist"]);
  });

  it.each([
    ["an entry with a missing field", [{ ...entry, submitUrl: undefined }], "betalist"],
    ["an unknown pricing", [{ ...entry, pricing: "cheap" }], "betalist"],
    ["an entry the domain refuses", [{ ...entry, submitUrl: "ftp://betalist.com" }], "betalist"],
    ["a duplicate slug", [entry, entry], "Duplicate directory slug: betalist"],
    ["something that is not a list", { entry }, "list"],
  ])("refuses %s, naming it", (_case, json, message) => {
    const result = parseSeedDirectories(json);
    expect(result.ok ? undefined : result.error).toContain(message);
  });
});
