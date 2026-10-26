import type { ReportWeek } from "../analytics/report-week";
import type { AutopilotRunId, CampaignId, ProductId } from "../shared/ids";

/** What one weekly loop did, shown on the autopilot card. */
export interface AutopilotRunSummary {
  /** Tasks the strategist proposed and Nuvantre accepted. */
  readonly planned: number;
  /** Proposed tasks Nuvantre dropped (ungrounded, repeated, over a cap). */
  readonly dropped: number;
  /** Items now waiting in the Inbox. */
  readonly drafted: number;
  /** Items rewritten once for the reviewer's blockers. */
  readonly redrafted: number;
  /** Tasks whose draft failed; the rest of the week still ran. */
  readonly failed: number;
  readonly stoppedAtLimit: boolean;
}

export type AutopilotRunOutcome =
  | {
      readonly kind: "completed";
      readonly campaignId: CampaignId;
      readonly summary: AutopilotRunSummary;
    }
  | { readonly kind: "skipped"; readonly reason: string }
  | { readonly kind: "failed"; readonly reason: string };

/** One run of the weekly loop for one product and week; there is at most one per week. */
export interface AutopilotRun {
  readonly id: AutopilotRunId;
  readonly productId: ProductId;
  readonly week: ReportWeek;
  readonly outcome: AutopilotRunOutcome;
  readonly ranAt: Date;
}
