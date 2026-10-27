import type { ContentLocale, Result } from "@nuvantre/domain";
import type { PortError } from "./port-error";

export interface KeywordQuery {
  readonly seeds: readonly string[];
  /** The language and market to research; a provider may lack data for some markets. */
  readonly locale: ContentLocale;
  readonly limit: number;
}

export interface KeywordIdea {
  readonly keyword: string;
  readonly monthlySearches: number;
  /** 0 (easy) to 100 (hardest). */
  readonly difficulty: number;
}

/** `unsupported_market`: the provider has no search data for that language and market. */
export type KeywordError = PortError<
  "quota_exceeded" | "unavailable" | "invalid_request" | "unsupported_market"
>;

export interface KeywordProvider {
  suggest(query: KeywordQuery): Promise<Result<readonly KeywordIdea[], KeywordError>>;
}
