import type { RateLimitRule } from "@nuvantre/ports";

/** Every limited action and its rule. A new limited action is one more row. */
export const rateLimits = {
  /** Per address and email: slows password guessing without locking the founder out. */
  login: { limit: 10, windowSeconds: 15 * 60 },
  /** Per address. */
  signup: { limit: 5, windowSeconds: 60 * 60 },
  /** Per workspace: briefs, articles, social weeks, launch kits and "run this week now". */
  draft: { limit: 30, windowSeconds: 60 * 60 },
  /** Per workspace: blog, social and analytics connections. */
  connect: { limit: 20, windowSeconds: 60 * 60 },
  /** Per address, for the billing webhook. */
  webhook: { limit: 120, windowSeconds: 60 },
  /** Per workspace, for report and invitation emails. */
  email: { limit: 50, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitPolicy = keyof typeof rateLimits;

export const rateLimitKey = (policy: RateLimitPolicy, ...parts: readonly string[]): string =>
  [policy, ...parts.map((part) => part.trim().toLowerCase())].join(":");

export const rateLimitMessage = (retryAfterSeconds: number): string => {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many attempts. Try again in ${String(minutes)} minute${minutes === 1 ? "" : "s"}.`;
};
