import { err, ok, type Result } from "@launchpilot/domain";
import type {
  ContentReviewer,
  ReviewError,
  ReviewRequest,
  ReviewVerdict,
} from "@launchpilot/ports";
import { NextFailure } from "./next-failure";

export class FakeContentReviewer implements ContentReviewer {
  readonly requests: ReviewRequest[] = [];
  private readonly failure = new NextFailure<ReviewError>();
  private verdict: ReviewVerdict = { decision: "pass", issues: [] };

  respondWith(verdict: ReviewVerdict): void {
    this.verdict = verdict;
  }

  failNext(error: ReviewError): void {
    this.failure.set(error);
  }

  review(request: ReviewRequest): Promise<Result<ReviewVerdict, ReviewError>> {
    this.requests.push(request);
    const error = this.failure.take();
    return Promise.resolve(error ? err(error) : ok(this.verdict));
  }
}
