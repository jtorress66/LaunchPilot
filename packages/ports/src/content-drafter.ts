import type {
  ArticleSeo,
  BriefContent,
  Channel,
  ContentLocale,
  InternalLink,
  Result,
  TaskKind,
} from "@nuvantre/domain";
import type { PortError } from "./port-error";

export interface DraftRequest {
  readonly brief: BriefContent;
  readonly channel: Channel;
  readonly task: { readonly kind: TaskKind; readonly title: string };
  readonly keywords?: readonly string[];
  /** Reviewer or founder feedback on the previous revision. */
  readonly revisionNote?: string;
  /** A URL the content must include, e.g. the article a social post promotes. */
  readonly link?: string;
  /** The language and market to write for; US English when absent. */
  readonly locale?: ContentLocale;
  /** The product's published articles: the only pages an article may link to. */
  readonly internalLinks?: readonly InternalLink[];
}

export interface Draft {
  readonly title: string;
  readonly body: string;
  /** Brief facts the draft relies on; must be a subset of `brief.facts`. */
  readonly citedFacts: readonly string[];
  /** URL slug and excerpt for search results; articles only. */
  readonly seo?: ArticleSeo;
}

export type DraftError = PortError<"generation_failed" | "unavailable">;

/** Writes one piece of content. Drafting only: it never reviews or plans. */
export interface ContentDrafter {
  draft(request: DraftRequest): Promise<Result<Draft, DraftError>>;
}
