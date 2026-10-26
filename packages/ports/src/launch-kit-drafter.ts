import type { BriefContent, CommunityChannel, Listing, Result } from "@nuvantre/domain";
import type { DraftError } from "./content-drafter";

export interface LaunchKitRequest {
  readonly brief: BriefContent;
  readonly product: { readonly name: string; readonly url: string };
}

/** A post the founder makes in a community themselves. Always a draft. */
export interface CommunityDraft {
  readonly channel: CommunityChannel;
  readonly title: string;
  readonly body: string;
}

export interface LaunchKitDraft {
  readonly listing: Listing;
  readonly community: readonly CommunityDraft[];
  /** Brief facts the kit relies on; must be a subset of `brief.facts`. */
  readonly citedFacts: readonly string[];
}

/** Writes a product's launch kit from its approved brief. Drafting only: it never submits. */
export interface LaunchKitDrafter {
  draft(request: LaunchKitRequest): Promise<Result<LaunchKitDraft, DraftError>>;
}
