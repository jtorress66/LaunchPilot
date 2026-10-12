import type { BriefContent, QuotedFact, Result } from "@launchpilot/domain";
import type { LlmError } from "./llm-client";
import type { PortError } from "./port-error";
import type { CrawledSite } from "./site-crawler";

export interface BriefDraftRequest {
  readonly productName: string;
  readonly site: CrawledSite;
}

export interface BriefDraft {
  readonly content: BriefContent;
  /** One supporting quote from the site for every fact in `content.facts`. */
  readonly evidence: readonly QuotedFact[];
  /** Claims removed because the site did not support them; shown to the founder. */
  readonly droppedClaims: readonly string[];
}

export type BriefDraftError =
  | LlmError
  | PortError<"generation_failed" | "ungrounded">;

/** Drafts a Product Brief from the founder's crawled site. Drafting only. */
export interface BriefDrafter {
  draft(request: BriefDraftRequest): Promise<Result<BriefDraft, BriefDraftError>>;
}
