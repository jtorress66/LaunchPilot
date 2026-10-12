export interface KeywordMetrics {
  readonly keyword: string;
  readonly monthlySearches: number;
  /** 0 (easy) to 100 (hardest). */
  readonly difficulty: number;
}

export interface OpportunityOptions {
  readonly max: number;
  readonly maxDifficulty?: number;
  readonly minVolume?: number;
}

const normalise = (keyword: string) => keyword.trim().toLowerCase().replace(/\s+/g, " ");

/** Searches won per point of difficulty; the +10 keeps zero-difficulty terms from dominating. */
const score = ({ monthlySearches, difficulty }: KeywordMetrics) =>
  monthlySearches / (difficulty + 10);

/**
 * Picks the keywords a small site can realistically rank for: enough searches,
 * not too competitive, best opportunity first. Deterministic for equal scores.
 */
export const rankKeywordOpportunities = (
  ideas: readonly KeywordMetrics[],
  { max, maxDifficulty = 60, minVolume = 10 }: OpportunityOptions,
): KeywordMetrics[] => {
  const best = new Map<string, { idea: KeywordMetrics; order: number }>();
  ideas.forEach((idea, order) => {
    const key = normalise(idea.keyword);
    if (key === "" || idea.difficulty > maxDifficulty || idea.monthlySearches < minVolume) return;
    const current = best.get(key);
    if (!current || score(idea) > score(current.idea)) best.set(key, { idea, order });
  });
  return [...best.values()]
    .sort((a, b) => score(b.idea) - score(a.idea) || a.order - b.order)
    .slice(0, max)
    .map(({ idea }) => idea);
};
