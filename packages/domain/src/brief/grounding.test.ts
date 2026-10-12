import { describe, expect, it } from "vitest";
import { isGrounded, keepGroundedFacts } from "./grounding";

const corpus = [
  "Acme Analytics — privacy-friendly analytics for SaaS.",
  "Start your free 14-day trial. No credit card required.",
  "We’re GDPR compliant and never use cookies.",
].join("\n");

describe("grounding", () => {
  it("accepts a quote copied exactly from the site", () => {
    expect(isGrounded("Start your free 14-day trial.", corpus)).toBe(true);
  });

  it("ignores differences in whitespace, case and quote style", () => {
    expect(isGrounded("start your FREE   14-day\ntrial", corpus)).toBe(true);
    expect(isGrounded("We're GDPR compliant", corpus)).toBe(true);
  });

  it("rejects a paraphrase that the site does not contain", () => {
    expect(isGrounded("Two weeks free, no card needed", corpus)).toBe(false);
  });

  it("rejects an empty quote", () => {
    expect(isGrounded("  ", corpus)).toBe(false);
    expect(isGrounded("...", corpus)).toBe(false);
  });

  it("keeps facts whose quote is on the site and reports the rest", () => {
    const result = keepGroundedFacts(
      [
        { statement: "Free 14-day trial", quote: "free 14-day trial" },
        { statement: "Used by 10,000 teams", quote: "Trusted by 10,000 teams" },
        { statement: "No cookies", quote: "never use cookies" },
      ],
      corpus,
    );
    expect(result).toEqual({
      kept: [
        { statement: "Free 14-day trial", quote: "free 14-day trial" },
        { statement: "No cookies", quote: "never use cookies" },
      ],
      dropped: ["Used by 10,000 teams"],
    });
  });
});
