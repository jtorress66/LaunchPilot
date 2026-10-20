import { describe, expect, it } from "vitest";
import { parseDirectory, type DirectoryInput } from "./directory";
import { fitListing } from "./fit-listing";
import type { Listing } from "./launch-kit";

const directory = (limits: DirectoryInput["limits"]) => {
  const result = parseDirectory({
    slug: "betalist",
    name: "BetaList",
    kind: "launch_platform",
    channel: "directory",
    homepageUrl: "https://betalist.com",
    submitUrl: "https://betalist.com/submit",
    pricing: "free",
    priceNote: null,
    topics: [],
    limits,
    checkedAt: "2026-10-15",
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const aListing = (overrides: Partial<Listing> = {}): Listing => ({
  name: "Acme Analytics",
  tagline: "Privacy-friendly analytics in one weekly email",
  shortDescription: "Five numbers that matter, without cookies or dashboards.",
  longDescription: "Acme sends founders the five numbers that matter every Monday.",
  features: ["No cookies", "Setup in two minutes", "Weekly email"],
  categories: ["Analytics", "SaaS"],
  makerComment: "Hi everyone!",
  ...overrides,
});

describe("fitListing", () => {
  it("returns the listing fields unchanged when they fit", () => {
    const listing = aListing();
    expect(fitListing(listing, directory({ tagline: 60, shortDescription: 160 }))).toEqual({
      fields: {
        name: listing.name,
        tagline: listing.tagline,
        shortDescription: listing.shortDescription,
        longDescription: listing.longDescription,
        features: listing.features,
        categories: listing.categories,
      },
      warnings: [],
    });
  });

  it("warns, without cutting, when a field is over the directory's limit", () => {
    const listing = aListing({ tagline: "a".repeat(50), shortDescription: "b".repeat(150) });
    const fitted = fitListing(listing, directory({ tagline: 40, shortDescription: 140 }));
    expect(fitted.fields.tagline).toBe("a".repeat(50));
    expect(fitted.warnings).toEqual([
      "Tagline is 50 characters; BetaList allows 40.",
      "Short description is 150 characters; BetaList allows 140.",
    ]);
  });
});
