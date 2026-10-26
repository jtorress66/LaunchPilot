import { err, maxLengthOf, ok, type Result } from "@nuvantre/domain";
import type {
  ContentReviewer,
  ReviewError,
  ReviewIssue,
  ReviewRequest,
  ReviewVerdict,
} from "@nuvantre/ports";
import { NextFailure } from "./next-failure";

/** The scripted verdict, plus the checks every reviewer must make: length and a required link. */
export class FakeContentReviewer implements ContentReviewer {
  readonly requests: ReviewRequest[] = [];
  private readonly failure = new NextFailure<ReviewError>();
  private readonly verdicts: ReviewVerdict[] = [];
  private verdict: ReviewVerdict = { decision: "pass", issues: [] };

  respondWith(verdict: ReviewVerdict): void {
    this.verdict = verdict;
  }

  /** Verdicts for the next reviews, in order; then the default again. */
  respondOnce(...verdicts: ReviewVerdict[]): void {
    this.verdicts.push(...verdicts);
  }

  failNext(error: ReviewError): void {
    this.failure.set(error);
  }

  review(request: ReviewRequest): Promise<Result<ReviewVerdict, ReviewError>> {
    this.requests.push(request);
    const error = this.failure.take();
    if (error) return Promise.resolve(err(error));
    const scripted = this.verdicts.shift() ?? this.verdict;
    const blockers: ReviewIssue[] = [
      ...(request.body.length > maxLengthOf(request.channel)
        ? [{ severity: "blocker" as const, message: "The text is over the channel's limit" }]
        : []),
      ...(request.link !== undefined && !request.body.includes(request.link)
        ? [{ severity: "blocker" as const, message: `Include the link ${request.link}` }]
        : []),
    ];
    const issues = [...blockers, ...scripted.issues];
    return Promise.resolve(
      ok({ decision: blockers.length > 0 ? "needs_changes" : scripted.decision, issues }),
    );
  }
}
