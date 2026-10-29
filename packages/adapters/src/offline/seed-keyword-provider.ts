import { err, ok, type Result } from "@nuvantre/domain";
import type { KeywordError, KeywordIdea, KeywordProvider, KeywordQuery } from "@nuvantre/ports";

/**
 * Phrase patterns with made-up but stable metrics, so plans look realistic offline.
 * They assume nothing about the audience, and the founder's own phrase scores best.
 */
const patterns: readonly [(seed: string) => string, number, number][] = [
  [(s) => s, 100, 30],
  [(s) => `what is ${s}`, 90, 35],
  [(s) => `${s} guide`, 80, 30],
  [(s) => `${s} examples`, 70, 30],
  [(s) => `how to choose ${s}`, 60, 25],
  [(s) => `${s} checklist`, 50, 20],
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
    // The phrase patterns are English; elsewhere only the founder's own phrases are researched.
    const phrasing = query.locale.language === "en" ? patterns : patterns.slice(0, 1);
    const ideas = seeds.flatMap((seed) =>
      phrasing.map(([phrase, monthlySearches, difficulty]) => ({
        keyword: phrase(seed),
        monthlySearches,
        difficulty,
      })),
    );
    return Promise.resolve(ok(ideas.slice(0, query.limit)));
  }
}
