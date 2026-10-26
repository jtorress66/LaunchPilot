import { planPostAngles, type BriefContent, type WeekCandidates } from "@nuvantre/domain";
import type { PlanRequest } from "@nuvantre/ports";
import { aBriefContent } from "./entities";

/** Ranked keyword opportunities and brief-derived angles, as the weekly loop offers them. */
export const someCandidates = (brief: BriefContent = aBriefContent()): WeekCandidates => ({
  keywords: [
    { keyword: "cookieless analytics", monthlySearches: 480, difficulty: 12 },
    { keyword: "gdpr analytics tool", monthlySearches: 320, difficulty: 18 },
    { keyword: "plausible alternative", monthlySearches: 210, difficulty: 25 },
  ],
  angles: planPostAngles(brief, { x: 3, linkedin: 2 }),
});

export const aPlanRequest = (overrides: Partial<PlanRequest> = {}): PlanRequest => {
  const brief = overrides.brief ?? aBriefContent();
  return {
    product: { name: "Acme Analytics" },
    brief,
    week: {
      start: new Date("2026-01-05T00:00:00.000Z"),
      end: new Date("2026-01-12T00:00:00.000Z"),
    },
    lastWeek: null,
    allowance: 10,
    candidates: someCandidates(brief),
    ...overrides,
  };
};
