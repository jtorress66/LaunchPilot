import type { BriefContent, Channel, MetricsSnapshot, Result, TaskKind } from "@launchpilot/domain";
import type { PortError } from "./port-error";

export interface PlanRequest {
  readonly brief: BriefContent;
  readonly weekStarting: Date;
  readonly lastWeek?: MetricsSnapshot;
}

export interface PlannedTask {
  readonly kind: TaskKind;
  readonly channel: Channel;
  readonly title: string;
  readonly rationale: string;
}

export interface CampaignPlan {
  readonly name: string;
  readonly goal: string;
  readonly tasks: readonly PlannedTask[];
}

export type PlanError = PortError<"planning_failed" | "unavailable">;

/** Turns the brief and last week's results into this week's plan. Planning only. */
export interface CampaignPlanner {
  plan(request: PlanRequest): Promise<Result<CampaignPlan, PlanError>>;
}
