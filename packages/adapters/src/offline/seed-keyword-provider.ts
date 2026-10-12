import { err, ok, type Result } from "@launchpilot/domain";
import type { KeywordError, KeywordIdea, KeywordProvider, KeywordQuery } from "@launchpilot/ports";

/** Phrase patterns with made-up but stable metrics, so plans look realistic offline. */
const patterns: readonly [(seed: string) => string, number, number][] = [
  [(s) => s, 100, 30],
  [(s) => `what is ${s}`, 90, 25],
  [(s) => `${s} for small business`, 80, 20],
  [(s) => `best ${s} tools`, 70, 35],
  [(s) => `how to choose ${s}`, 60, 15],
  [(s) => `${s} checklist`, 50, 10],
];

/**
 * Deterministic keyword ideas derived from the seeds, with no API calls.
 * For local development only; the composition root refuses it in production.
 */
export class SeedKeywordProvider implements KeywordProvider {
  suggest(query: KeywordQuery): Promise<Result<readonly KeywordIdea[], KeywordError>> {
    const seeds = query.seeds.map((s) => s.trim().toLowerCase()).filter((s) => s !== "");
    if (seeds.length === 0) {
      return Promise.resolve(
        err({ code: "invalid_request", message: "Enter at least one topic", retryable: false }),
      );
    }
    const ideas = seeds.flatMap((seed) =>
      patterns.map(([phrase, monthlySearches, difficulty]) => ({
        keyword: phrase(seed),
        monthlySearches,
        difficulty,
      })),
    );
    return Promise.resolve(ok(ideas.slice(0, query.limit)));
  }
}
