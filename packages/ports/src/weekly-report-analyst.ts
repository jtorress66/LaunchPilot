import type { AnalystNotes, BriefContent, Result, WeeklyReport } from "@launchpilot/domain";
import type { PortError } from "./port-error";

export interface AnalysisRequest {
  readonly product: { readonly name: string };
  /** The approved brief, when there is one: its facts are the only product facts allowed. */
  readonly brief: BriefContent | null;
  readonly report: WeeklyReport;
}

export interface Analysis extends AnalystNotes {
  /** Brief facts the notes rely on; must be a subset of `brief.facts`. */
  readonly citedFacts: readonly string[];
}

export type AnalysisError = PortError<"analysis_failed" | "unavailable">;

/** Writes the notes on a weekly report. Analysis only: it never fetches, plans or publishes. */
export interface WeeklyReportAnalyst {
  analyse(request: AnalysisRequest): Promise<Result<Analysis, AnalysisError>>;
}
