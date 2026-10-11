import type { BriefContent, Channel, Result } from "@launchpilot/domain";
import type { PortError } from "./port-error";

export interface ReviewRequest {
  readonly brief: BriefContent;
  readonly channel: Channel;
  readonly title: string;
  readonly body: string;
}

export interface ReviewIssue {
  readonly severity: "blocker" | "suggestion";
  readonly message: string;
}

export interface ReviewVerdict {
  /** A recommendation for the founder; only the founder approves. */
  readonly decision: "pass" | "needs_changes";
  readonly issues: readonly ReviewIssue[];
}

export type ReviewError = PortError<"review_failed" | "unavailable">;

/** Checks a draft against the brief and channel rules. Reviewing only. */
export interface ContentReviewer {
  review(request: ReviewRequest): Promise<Result<ReviewVerdict, ReviewError>>;
}
