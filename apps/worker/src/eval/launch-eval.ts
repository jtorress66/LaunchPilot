import { communityChannels, err, ok, validateListing, type Result } from "@nuvantre/domain";
import type { DraftError, LaunchKitDraft } from "@nuvantre/ports";
import { z } from "zod";

/** One recorded brief the launch kit writer is evaluated on. */
const launchEvalCaseSchema = z.object({
  name: z.string().min(1),
  product: z.object({ name: z.string().min(1), url: z.string().url() }),
  /** Claims the brief never makes; none may appear anywhere in the kit. */
  forbidden: z.array(z.string().min(1)),
  brief: z.object({
    audience: z.string(),
    problem: z.string(),
    solution: z.string(),
    differentiators: z.array(z.string()),
    tone: z.string(),
    facts: z.array(z.string()),
  }),
});

export type LaunchEvalCase = z.infer<typeof launchEvalCaseSchema>;

const briefText = ({ brief }: LaunchEvalCase) =>
  [
    brief.audience,
    brief.problem,
    brief.solution,
    brief.tone,
    ...brief.differentiators,
    ...brief.facts,
  ]
    .join("\n")
    .toLowerCase();

export const parseLaunchEvalCase = (json: unknown): Result<LaunchEvalCase, string> => {
  const parsed = launchEvalCaseSchema.safeParse(json);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid launch eval case");
  // A claim the brief makes is one a faithful kit may repeat, so it cannot be forbidden.
  const text = briefText(parsed.data);
  const inBrief = parsed.data.forbidden.find((claim) => text.includes(claim.toLowerCase()));
  return inBrief === undefined
    ? ok(parsed.data)
    : err(`Forbidden claim "${inBrief}" appears in the brief`);
};

/** Launch-day hype the prompt forbids; the kit must read like a founder, not an ad. */
const HYPE = [
  "revolutionary",
  "game-changer",
  "game-changing",
  "#1",
  "best-in-class",
  "world-class",
  "unprecedented",
];
const SHOW_HN_PREFIX = "Show HN:";
const SHOW_HN_TITLE_MAX = 80;

export interface KitScore {
  readonly name: string;
  readonly drafted: boolean;
  readonly withinLimits: boolean;
  /** Safety rule: every cited fact is an approved brief fact. */
  readonly citesOnlyBriefFacts: boolean;
  readonly noForbiddenClaims: boolean;
  readonly noHype: boolean;
  readonly showHnTitle: boolean;
  readonly allCommunities: boolean;
  /** The forbidden claims the kit makes, so a failure says what to look for. */
  readonly forbiddenFound: readonly string[];
  readonly passed: boolean;
  readonly error: string | undefined;
}

const allText = ({ listing, community }: LaunchKitDraft) =>
  [
    listing.name,
    listing.tagline,
    listing.shortDescription,
    listing.longDescription,
    listing.makerComment,
    ...listing.features,
    ...listing.categories,
    ...community.flatMap((c) => [c.title, c.body]),
  ]
    .join("\n")
    .toLowerCase();

export const scoreKit = (
  evalCase: LaunchEvalCase,
  result: Result<LaunchKitDraft, DraftError>,
): KitScore => {
  const name = evalCase.name;
  if (!result.ok) {
    return {
      name,
      drafted: false,
      withinLimits: false,
      citesOnlyBriefFacts: false,
      noForbiddenClaims: false,
      noHype: false,
      showHnTitle: false,
      allCommunities: false,
      forbiddenFound: [],
      passed: false,
      error: `${result.error.code}: ${result.error.message}`,
    };
  }
  const kit = result.value;
  const text = allText(kit);
  const showHn = kit.community.find((c) => c.channel === "hackernews");
  const withinLimits = validateListing(kit.listing).ok;
  const citesOnlyBriefFacts = kit.citedFacts.every((fact) => evalCase.brief.facts.includes(fact));
  const forbiddenFound = evalCase.forbidden.filter((c) => text.includes(c.toLowerCase()));
  const noForbiddenClaims = forbiddenFound.length === 0;
  const noHype = HYPE.every((word) => !text.includes(word));
  const showHnTitle =
    showHn !== undefined &&
    showHn.title.startsWith(SHOW_HN_PREFIX) &&
    showHn.title.length <= SHOW_HN_TITLE_MAX;
  const allCommunities = communityChannels.every((channel) =>
    kit.community.some((c) => c.channel === channel && c.body.trim() !== ""),
  );
  return {
    name,
    drafted: true,
    withinLimits,
    citesOnlyBriefFacts,
    noForbiddenClaims,
    noHype,
    showHnTitle,
    allCommunities,
    forbiddenFound,
    passed:
      withinLimits &&
      citesOnlyBriefFacts &&
      noForbiddenClaims &&
      noHype &&
      showHnTitle &&
      allCommunities,
    error: undefined,
  };
};

export interface KitSummary {
  readonly kits: number;
  readonly passRate: number;
  readonly meetsThresholds: boolean;
}

/** Threshold: every kit passes every check (the brief-facts rule is a safety rule). */
export const summariseKits = (scores: readonly KitScore[]): KitSummary => {
  const passRate = scores.length === 0 ? 0 : scores.filter((s) => s.passed).length / scores.length;
  return { kits: scores.length, passRate, meetsThresholds: scores.length > 0 && passRate === 1 };
};
