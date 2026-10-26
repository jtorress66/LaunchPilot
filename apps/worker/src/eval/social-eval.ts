import { err, maxLengthOf, ok, type Result } from "@nuvantre/domain";
import type { Draft, DraftError } from "@nuvantre/ports";
import { z } from "zod";

const angleSchema = z.object({
  channel: z.enum(["x", "linkedin"]),
  angle: z.string().min(1),
  link: z.string().url().optional(),
});

/** One recorded brief and the post angles the social writer is evaluated on. */
const socialEvalCaseSchema = z.object({
  name: z.string().min(1),
  /** Claims the brief never makes; none may appear in a post. */
  forbidden: z.array(z.string().min(1)),
  brief: z.object({
    audience: z.string(),
    problem: z.string(),
    solution: z.string(),
    differentiators: z.array(z.string()),
    tone: z.string(),
    facts: z.array(z.string()),
  }),
  angles: z.array(angleSchema).min(1),
});

export type SocialEvalCase = z.infer<typeof socialEvalCaseSchema>;
export type SocialEvalAngle = z.infer<typeof angleSchema>;

export const parseSocialEvalCase = (json: unknown): Result<SocialEvalCase, string> => {
  const parsed = socialEvalCaseSchema.safeParse(json);
  return parsed.success
    ? ok(parsed.data)
    : err(parsed.error.issues[0]?.message ?? "Invalid social eval case");
};

const MAX_HASHTAGS = { x: 2, linkedin: 3 } as const;

export interface PostScore {
  readonly name: string;
  readonly drafted: boolean;
  readonly withinLimit: boolean;
  /** Safety rule: every cited fact is an approved brief fact. */
  readonly citesOnlyBriefFacts: boolean;
  readonly noForbiddenClaims: boolean;
  readonly fewHashtags: boolean;
  readonly includesLink: boolean;
  readonly characters: number;
  readonly passed: boolean;
  readonly error: string | undefined;
}

export const scorePost = (
  evalCase: SocialEvalCase,
  angle: SocialEvalAngle,
  result: Result<Draft, DraftError>,
): PostScore => {
  const name = `${evalCase.name}/${angle.channel}`;
  if (!result.ok) {
    return {
      name,
      drafted: false,
      withinLimit: false,
      citesOnlyBriefFacts: false,
      noForbiddenClaims: false,
      fewHashtags: false,
      includesLink: false,
      characters: 0,
      passed: false,
      error: `${result.error.code}: ${result.error.message}`,
    };
  }
  const { body, citedFacts } = result.value;
  const lower = body.toLowerCase();
  const withinLimit = body.trim() !== "" && body.length <= maxLengthOf(angle.channel);
  const citesOnlyBriefFacts = citedFacts.every((fact) => evalCase.brief.facts.includes(fact));
  const noForbiddenClaims = evalCase.forbidden.every((c) => !lower.includes(c.toLowerCase()));
  const fewHashtags = (body.match(/#\w+/g) ?? []).length <= MAX_HASHTAGS[angle.channel];
  const includesLink = angle.link === undefined || body.includes(angle.link);
  return {
    name,
    drafted: true,
    withinLimit,
    citesOnlyBriefFacts,
    noForbiddenClaims,
    fewHashtags,
    includesLink,
    characters: body.length,
    passed: withinLimit && citesOnlyBriefFacts && noForbiddenClaims && fewHashtags && includesLink,
    error: undefined,
  };
};

export interface PostSummary {
  readonly posts: number;
  readonly passRate: number;
  readonly meetsThresholds: boolean;
}

/** Threshold: every post passes every check (the brief-facts rule is a safety rule). */
export const summarisePosts = (scores: readonly PostScore[]): PostSummary => {
  const passRate = scores.length === 0 ? 0 : scores.filter((s) => s.passed).length / scores.length;
  return { posts: scores.length, passRate, meetsThresholds: scores.length > 0 && passRate === 1 };
};
