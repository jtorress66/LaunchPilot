import { err, ok, type Result } from "@launchpilot/domain";
import type {
  ContentReviewer,
  ReviewError,
  ReviewRequest,
  ReviewVerdict,
} from "@launchpilot/ports";
import { draftBlockers, isEmptyDraft } from "./draft-checks";

/** Deterministic, offline review: the rule checks only. For development, tests and E2E. */
export class TemplateReviewer implements ContentReviewer {
  review(request: ReviewRequest): Promise<Result<ReviewVerdict, ReviewError>> {
    if (isEmptyDraft(request)) {
      return Promise.resolve(
        err({ code: "review_failed", message: "The draft is empty", retryable: false }),
      );
    }
    const issues = draftBlockers(request);
    return Promise.resolve(
      ok({ decision: issues.length === 0 ? "pass" : "needs_changes", issues }),
    );
  }
}
