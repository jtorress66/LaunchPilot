import { err, ok, type Result } from "@launchpilot/domain";
import type {
  Analysis,
  AnalysisError,
  AnalysisRequest,
  WeeklyReportAnalyst,
} from "@launchpilot/ports";
import { NextFailure } from "./next-failure";

/** Fixed notes naming the week; records requests. */
export class FakeWeeklyReportAnalyst implements WeeklyReportAnalyst {
  readonly requests: AnalysisRequest[] = [];
  private readonly failure = new NextFailure<AnalysisError>();

  failNext(error: AnalysisError): void {
    this.failure.set(error);
  }

  analyse(request: AnalysisRequest): Promise<Result<Analysis, AnalysisError>> {
    this.requests.push(request);
    const error = this.failure.take();
    if (error) return Promise.resolve(err(error));
    return Promise.resolve(
      ok({
        summary: `Notes on ${request.product.name} for ${request.report.weekKey}.`,
        highlights: [],
        suggestions: ["Keep publishing."],
        citedFacts: request.brief?.facts.slice(0, 1) ?? [],
      }),
    );
  }
}
