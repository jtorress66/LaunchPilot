/** At most `limit` attempts per fixed window of `windowSeconds`. */
export interface RateLimitRule {
  readonly limit: number;
  readonly windowSeconds: number;
}

export type RateLimitDecision =
  { readonly allowed: true } | { readonly allowed: false; readonly retryAfterSeconds: number };

/** Counts attempts per key (e.g. "login:1.2.3.4:founder@acme.dev") and refuses over the rule. */
export interface RateLimiter {
  consume(key: string, rule: RateLimitRule): Promise<RateLimitDecision>;
}
