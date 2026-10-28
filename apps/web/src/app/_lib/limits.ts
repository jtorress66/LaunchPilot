import "server-only";
import type { RateLimitPolicy } from "@nuvantre/application";
import { headers } from "next/headers";
import { getAppContainer } from "../../container";
import { clientAddress } from "../../server/rate-limit";

/** The caller's address for per-address limits, trusted from a proxy only when configured. */
export const requestAddress = async (): Promise<string> =>
  clientAddress(await headers(), getAppContainer().trustProxy);

/** Null when the attempt may go ahead; otherwise the message that tells the founder to wait. */
export const refusedByLimit = async (
  policy: RateLimitPolicy,
  ...parts: string[]
): Promise<string | null> => {
  const decision = await getAppContainer().rateGuard(policy, ...parts);
  return decision.allowed ? null : decision.message;
};
