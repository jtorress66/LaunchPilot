import type { BriefContent, Channel, Result, TaskKind } from "@launchpilot/domain";
import type { PortError } from "./port-error";

export interface DraftRequest {
  readonly brief: BriefContent;
  readonly channel: Channel;
  readonly task: { readonly kind: TaskKind; readonly title: string };
  readonly keywords?: readonly string[];
  /** Reviewer or founder feedback on the previous revision. */
  readonly revisionNote?: string;
}

export interface Draft {
  readonly title: string;
  readonly body: string;
  /** Brief facts the draft relies on; must be a subset of `brief.facts`. */
  readonly citedFacts: readonly string[];
}

export type DraftError = PortError<"generation_failed" | "unavailable">;

/** Writes one piece of content. Drafting only: it never reviews or plans. */
export interface ContentDrafter {
  draft(request: DraftRequest): Promise<Result<Draft, DraftError>>;
}
