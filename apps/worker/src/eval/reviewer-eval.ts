import { channels, err, ok, type Result } from "@launchpilot/domain";
import type { ReviewError, ReviewRequest, ReviewVerdict } from "@launchpilot/ports";
import { z } from "zod";

const draftSchema = z.object({
  /** What is wrong with the draft, or "good": shown when its verdict is wrong. */
  label: z.string().min(1),
  expected: z.enum(["pass", "needs_changes"]),
  channel: z.enum(channels),
  title: z.string(),
  body: z.string().min(1),
  link: z.string().url().optional(),
});

/** One brief with drafts labelled by hand as good or bad; the reviewer must agree with each. */
const reviewerEvalCaseSchema = z.object({
  name: z.string().min(1),
  brief: z.object({
    audience: z.string(),
    problem: z.string(),
    solution: z.string(),
    differentiators: z.array(z.string()),
    tone: z.string(),
    facts: z.array(z.string()),
  }),
  drafts: z.array(draftSchema).min(1),
});

export type ReviewerEvalCase = z.infer<typeof reviewerEvalCaseSchema>;
export type LabelledDraft = z.infer<typeof draftSchema>;

export const parseReviewerEvalCase = (json: unknown): Result<ReviewerEvalCase, string> => {
  const parsed = reviewerEvalCaseSchema.safeParse(json);
  return parsed.success
    ? ok(parsed.data)
    : err(parsed.error.issues[0]?.message ?? "Invalid reviewer eval case");
};

export const reviewRequestOf = (
  evalCase: ReviewerEvalCase,
  draft: LabelledDraft,
): ReviewRequest => ({
  brief: evalCase.brief,
  channel: draft.channel,
  title: draft.title,
  body: draft.body,
  ...(draft.link === undefined ? {} : { link: draft.link }),
});

export interface ReviewScore {
  readonly name: string;
  readonly reviewed: boolean;
  /** Safety rule: a bad draft is never recommended, and a good one is not held back. */
  readonly matchesLabel: boolean;
  /** A held-back draft names at least one blocker, so the redraft knows what to fix. */
  readonly explainsBlockers: boolean;
  readonly decision: ReviewVerdict["decision"] | undefined;
  readonly passed: boolean;
  readonly error: string | undefined;
}

export const scoreReview = (
  evalCase: ReviewerEvalCase,
  draft: LabelledDraft,
  result: Result<ReviewVerdict, ReviewError>,
): ReviewScore => {
  const name = `${evalCase.name}/${draft.label}`;
  if (!result.ok) {
    return {
      name,
      reviewed: false,
      matchesLabel: false,
      explainsBlockers: false,
      decision: undefined,
      passed: false,
      error: `${result.error.code}: ${result.error.message}`,
    };
  }
  const { decision, issues } = result.value;
  const checks = {
    matchesLabel: decision === draft.expected,
    explainsBlockers: decision === "pass" || issues.some((issue) => issue.severity === "blocker"),
  };
  return {
    name,
    reviewed: true,
    ...checks,
    decision,
    passed: Object.values(checks).every(Boolean),
    error: undefined,
  };
};

export interface ReviewSummary {
  readonly drafts: number;
  readonly passRate: number;
  readonly meetsThresholds: boolean;
}

/** Threshold: the reviewer agrees with every label. */
export const summariseReviews = (scores: readonly ReviewScore[]): ReviewSummary => {
  const passRate = scores.length === 0 ? 0 : scores.filter((s) => s.passed).length / scores.length;
  return { drafts: scores.length, passRate, meetsThresholds: scores.length > 0 && passRate === 1 };
};
