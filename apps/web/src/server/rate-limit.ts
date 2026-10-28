import {
  rateLimitKey,
  rateLimitMessage,
  rateLimits,
  type RateLimitPolicy,
} from "@nuvantre/application";
import type { RateLimiter } from "@nuvantre/ports";

/**
 * The client's address for per-address limits. X-Forwarded-For is only trusted behind a proxy
 * that sets it (TRUST_PROXY); otherwise every request counts as "direct".
 */
export const clientAddress = (headers: Headers, trustProxy: boolean): string => {
  if (!trustProxy) return "direct";
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first === undefined || first === "" ? "direct" : first;
};

export type RateDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSeconds: number; readonly message: string };

export type RateGuard = (policy: RateLimitPolicy, ...parts: string[]) => Promise<RateDecision>;

/** Checks one attempt against its policy (or a configured override) before the use case runs. */
export const createRateGuard =
  ({
    limiter,
    overrides,
  }: {
    readonly limiter: RateLimiter;
    readonly overrides: Readonly<Partial<Record<RateLimitPolicy, number>>>;
  }): RateGuard =>
  async (policy, ...parts) => {
    const rule = { ...rateLimits[policy], limit: overrides[policy] ?? rateLimits[policy].limit };
    const decision = await limiter.consume(rateLimitKey(policy, ...parts), rule);
    return decision.allowed
      ? decision
      : {
          allowed: false,
          retryAfterSeconds: decision.retryAfterSeconds,
          message: rateLimitMessage(decision.retryAfterSeconds),
        };
  };
