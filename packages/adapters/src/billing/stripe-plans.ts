import type { PlanId } from "@nuvantre/domain";

type PaidPlan = Exclude<PlanId, "free">;

/** Stripe prices are found by lookup key, so no price ids live in configuration. */
export const stripeLookupKeys: Readonly<Record<PaidPlan, string>> = {
  starter: "nuvantre_starter_monthly",
  growth: "nuvantre_growth_monthly",
};

/** Prices created before the product was renamed from LaunchPilot; existing subscriptions use them. */
const legacyLookupKeys: Readonly<Record<string, PaidPlan>> = {
  launchpilot_starter_monthly: "starter",
  launchpilot_growth_monthly: "growth",
};

export const planForLookupKey = (lookupKey: string | null | undefined): PaidPlan | undefined =>
  (Object.keys(stripeLookupKeys) as PaidPlan[]).find(
    (plan) => stripeLookupKeys[plan] === lookupKey,
  ) ?? (lookupKey ? legacyLookupKeys[lookupKey] : undefined);
