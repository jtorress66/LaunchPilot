import { describe, expect, it } from "vitest";
import { evalThresholds, parseThresholds } from "./thresholds";

// The minimums last agreed. Lowering one means editing this test, so it shows up in review.
const agreed = {
  brief: { grounding: 1, pass: 1 },
  seo: { facts: 1, pass: 1 },
  social: { pass: 1 },
  launch: { pass: 1 },
  analyst: { pass: 1 },
  strategist: { pass: 1 },
  reviewer: { pass: 1 },
};

describe("eval thresholds", () => {
  it("has an entry for every suite, none below the minimums last agreed", () => {
    for (const [suite, minimums] of Object.entries(agreed)) {
      for (const [score, minimum] of Object.entries(minimums)) {
        const value = (evalThresholds as Record<string, Record<string, number>>)[suite]?.[score];
        expect(value, `${suite}.${score}`).toBeGreaterThanOrEqual(minimum);
      }
    }
  });

  it("refuses a file that misses a suite or holds a rate outside 0 to 1", () => {
    expect(() => parseThresholds({ ...agreed, reviewer: undefined })).toThrow(/reviewer/);
    expect(() => parseThresholds({ ...agreed, social: { pass: 1.5 } })).toThrow(/social/);
  });
});
