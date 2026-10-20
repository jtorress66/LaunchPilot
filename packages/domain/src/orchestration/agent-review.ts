import type { ContentItem } from "../content-item/content-item";

export interface AgentReviewIssue {
  readonly severity: "blocker" | "suggestion";
  readonly message: string;
}

/**
 * The reviewer agent's verdict on a draft, shown to the founder next to it. A recommendation
 * only: the founder still approves or rejects.
 */
export interface AgentReview {
  readonly decision: "pass" | "needs_changes";
  readonly issues: readonly AgentReviewIssue[];
  /** True when the draft was rewritten once for the reviewer's blockers. */
  readonly redrafted: boolean;
  readonly reviewedAt: Date;
}

/** A verdict with any blocker can never pass, whatever the reviewer said. */
export const reviewOf = (
  verdict: {
    readonly decision: "pass" | "needs_changes";
    readonly issues: readonly AgentReviewIssue[];
  },
  { redrafted, at }: { readonly redrafted: boolean; readonly at: Date },
): AgentReview => ({
  decision: verdict.issues.some((i) => i.severity === "blocker")
    ? "needs_changes"
    : verdict.decision,
  issues: verdict.issues,
  redrafted,
  reviewedAt: at,
});

export const withAgentReview = (item: ContentItem, review: AgentReview): ContentItem => ({
  ...item,
  agentReview: review,
});
