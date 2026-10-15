import { describe, expect, it } from "vitest";
import { filterDirectories, parseDirectory, type DirectoryInput } from "./directory";

const input = (overrides: Partial<DirectoryInput> = {}): DirectoryInput => ({
  slug: "betalist",
  name: "BetaList",
  kind: "launch_platform",
  channel: "directory",
  homepageUrl: "https://betalist.com",
  submitUrl: "https://betalist.com/submit",
  pricing: "freemium",
  priceNote: "Free listing has a waiting list; paid skips the queue.",
  topics: ["startups", "early adopters"],
  limits: { tagline: 60 },
  checkedAt: "2026-10-15",
  ...overrides,
});

const parse = (overrides: Partial<DirectoryInput> = {}) => {
  const result = parseDirectory(input(overrides));
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("parseDirectory", () => {
  it("accepts a well-formed directory, normalising its URLs and check date", () => {
    expect(parse()).toEqual({
      slug: "betalist",
      name: "BetaList",
      kind: "launch_platform",
      channel: "directory",
      homepageUrl: "https://betalist.com/",
      submitUrl: "https://betalist.com/submit",
      pricing: "freemium",
      priceNote: "Free listing has a waiting list; paid skips the queue.",
      topics: ["startups", "early adopters"],
      limits: { tagline: 60 },
      checkedAt: new Date("2026-10-15T00:00:00.000Z"),
    });
  });

  it.each([
    ["a slug with spaces", { slug: "Beta List" }, "invalid_text"],
    ["an empty name", { name: " " }, "invalid_text"],
    ["a submit page that is not http(s)", { submitUrl: "mailto:hi@betalist.com" }, "invalid_url"],
    ["a non-positive limit", { limits: { tagline: 0 } }, "invalid_text"],
    ["a check date that is not a date", { checkedAt: "last week" }, "invalid_text"],
    [
      "a community on a non-community channel",
      { kind: "community" as const, channel: "directory" as const },
      "invalid_text",
    ],
    [
      "a listing site on a community channel",
      { kind: "directory" as const, channel: "reddit" as const },
      "invalid_text",
    ],
  ])("refuses %s", (_case, overrides, code) => {
    const result = parseDirectory(input(overrides));
    expect(result.ok ? undefined : result.error.code).toBe(code);
  });
});

describe("filterDirectories", () => {
  const all = [
    parse({ slug: "saashub", name: "SaaSHub", kind: "directory", pricing: "free" }),
    parse({
      slug: "show-hn",
      name: "Show HN",
      kind: "community",
      channel: "hackernews",
      pricing: "free",
      topics: ["developers"],
    }),
    parse({ slug: "product-hunt", name: "Product Hunt", channel: "producthunt", pricing: "free" }),
    parse(),
    parse({ slug: "g2", name: "G2", kind: "directory", pricing: "paid", topics: ["b2b"] }),
  ];

  it("lists launch platforms first, then directories, then communities, each by name", () => {
    expect(filterDirectories(all, {}).map((d) => d.slug)).toEqual([
      "betalist",
      "product-hunt",
      "g2",
      "saashub",
      "show-hn",
    ]);
  });

  it("filters by kind, pricing and topic", () => {
    expect(filterDirectories(all, { kind: "directory" }).map((d) => d.slug)).toEqual([
      "g2",
      "saashub",
    ]);
    expect(filterDirectories(all, { pricing: "free" }).map((d) => d.slug)).toEqual([
      "product-hunt",
      "saashub",
      "show-hn",
    ]);
    expect(filterDirectories(all, { topic: "developers" }).map((d) => d.slug)).toEqual(["show-hn"]);
  });
});
