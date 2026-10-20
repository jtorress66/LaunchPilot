import type {
  BriefContent,
  ProposedTask,
  ReportWeek,
  Result,
  WeekCandidates,
  WeeklyReport,
} from "@launchpilot/domain";
import type { PortError } from "./port-error";

export interface PlanRequest {
  readonly product: { readonly name: string };
  readonly brief: BriefContent;
  readonly week: ReportWeek;
  /** Last week's report, when there is one: the only figures a rationale may cite. */
  readonly lastWeek: WeeklyReport | null;
  /** Content items the plan's monthly allowance still has room for. */
  readonly allowance: number;
  /** The only keywords and post angles the plan may use. */
  readonly candidates: WeekCandidates;
}

export interface CampaignPlan {
  readonly name: string;
  readonly goal: string;
  readonly tasks: readonly ProposedTask[];
}

export type PlanError = PortError<"planning_failed" | "unavailable">;

/** Turns the brief, last week's report and the candidates into this week's plan. Planning only. */
export interface CampaignPlanner {
  plan(request: PlanRequest): Promise<Result<CampaignPlan, PlanError>>;
}
