import type { KeywordIdea, KeywordProvider, KeywordQuery } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";

export interface KeywordProviderHarness {
  readonly provider: KeywordProvider;
  givenIdeas(ideas: readonly KeywordIdea[]): void | Promise<void>;
  /** Arrange the next call to fail; a provider that only fails on bad input returns that input. */
  givenFailure(): KeywordQuery | undefined | Promise<KeywordQuery | undefined>;
}

const ideas: KeywordIdea[] = [
  { keyword: "saas marketing", monthlySearches: 4400, difficulty: 62 },
  { keyword: "indie saas marketing", monthlySearches: 320, difficulty: 18 },
  { keyword: "marketing for founders", monthlySearches: 880, difficulty: 35 },
];

export function describeKeywordProviderContract(
  name: string,
  make: () => KeywordProviderHarness | Promise<KeywordProviderHarness>,
): void {
  describe(`KeywordProvider contract: ${name}`, () => {
    it("returns at most `limit` ideas with valid search volume and difficulty", async () => {
      const harness = await make();
      await harness.givenIdeas(ideas);
      const result = await harness.provider.suggest({
        seeds: ["saas marketing"],
        locale: "en-US",
        limit: 2,
      });
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.length).toBeLessThanOrEqual(2);
      for (const idea of result.value) {
        expect(idea.monthlySearches).toBeGreaterThanOrEqual(0);
        expect(idea.difficulty).toBeGreaterThanOrEqual(0);
        expect(idea.difficulty).toBeLessThanOrEqual(100);
      }
    });

    it("reports a failure as a KeywordError result instead of throwing", async () => {
      const harness = await make();
      const failing = (await harness.givenFailure()) ?? { seeds: ["x"], locale: "en-US", limit: 5 };
      const result = await harness.provider.suggest(failing);
      expect(result.ok).toBe(false);
    });
  });
}
