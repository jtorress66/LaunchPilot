import { err, ok, plans, type Result } from "@launchpilot/domain";
import type Stripe from "stripe";
import { stripeLookupKeys } from "./stripe-plans";

/**
 * Creates the Stripe product and monthly price for each paid plan unless a price with its lookup
 * key already exists. Safe to run repeatedly. Prices come from the domain plan catalog.
 */
export const ensureStripePrices = async (
  stripe: Stripe,
): Promise<Result<{ created: string[] }, string>> => {
  const created: string[] = [];
  try {
    for (const [plan, lookupKey] of Object.entries(stripeLookupKeys) as [
      keyof typeof stripeLookupKeys,
      string,
    ][]) {
      const existing = await stripe.prices.list({
        lookup_keys: [lookupKey],
        active: true,
        limit: 1,
      });
      if (existing.data.length > 0) continue;
      await stripe.prices.create({
        lookup_key: lookupKey,
        currency: "usd",
        unit_amount: plans[plan].priceMonthlyUsd * 100,
        recurring: { interval: "month" },
        product_data: { name: `LaunchPilot ${plans[plan].name}` },
      });
      created.push(lookupKey);
    }
    return ok({ created });
  } catch (error) {
    return err(error instanceof Error ? error.message : "Stripe request failed");
  }
};
