import type { Result } from "@nuvantre/domain";
import type { PortError } from "./port-error";

export interface KeywordQuery {
  readonly seeds: readonly string[];
  readonly locale: string;
  readonly limit: number;
}

export interface KeywordIdea {
  readonly keyword: string;
  readonly monthlySearches: number;
  /** 0 (easy) to 100 (hardest). */
  readonly difficulty: number;
}

export type KeywordError = PortError<"quota_exceeded" | "unavailable" | "invalid_request">;

export interface KeywordProvider {
  suggest(query: KeywordQuery): Promise<Result<readonly KeywordIdea[], KeywordError>>;
}
