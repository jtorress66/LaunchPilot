import type { PlanId } from "@launchpilot/domain";

type PaidPlan = Exclude<PlanId, "free">;

/** Stripe prices are found by lookup key, so no price ids live in configuration. */
export const stripeLookupKeys: Readonly<Record<PaidPlan, string>> = {
  starter: "launchpilot_starter_monthly",
  growth: "launchpilot_growth_monthly",
};

export const planForLookupKey = (lookupKey: string | null | undefined): PaidPlan | undefined =>
  (Object.keys(stripeLookupKeys) as PaidPlan[]).find(
    (plan) => stripeLookupKeys[plan] === lookupKey,
  );
