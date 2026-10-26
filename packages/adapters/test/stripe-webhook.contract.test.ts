import type { BillingEvent } from "@nuvantre/domain";
import { describeBillingWebhookVerifierContract } from "@nuvantre/testing/contracts";
import Stripe from "stripe";
import { StripeWebhookVerifier } from "../src";
import { stripeLookupKeys } from "../src/billing/stripe-plans";

const secret = "whsec_test_0123456789abcdef";
const stripe = new Stripe("sk_test_offline", { httpClient: Stripe.createFetchHttpClient() });
const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

/** The Stripe webhook Stripe would send for each provider-neutral event. */
const stripeEventFor = (event: BillingEvent): Record<string, unknown> => {
  const base = {
    id: "evt_test",
    object: "event",
    api_version: "2025-08-27.basil",
    created: seconds(event.occurredAt),
  };
  if (event.type === "subscription_activated") {
    return {
      ...base,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          object: "checkout.session",
          mode: "subscription",
          payment_status: "paid",
          customer: event.providerCustomerId,
          subscription: event.providerSubscriptionId,
          metadata: { workspace_id: event.workspaceId, plan: event.plan },
        },
      },
    };
  }
  if (event.type === "subscription_updated") {
    return {
      ...base,
      type: "customer.subscription.updated",
      data: {
        object: {
          id: event.providerSubscriptionId,
          object: "subscription",
          status: event.status,
          items: {
            data: [
              {
                price: { lookup_key: stripeLookupKeys[event.plan as "starter" | "growth"] },
                current_period_end: event.currentPeriodEnd ? seconds(event.currentPeriodEnd) : null,
              },
            ],
          },
        },
      },
    };
  }
  return {
    ...base,
    type: "customer.subscription.deleted",
    data: {
      object: { id: event.providerSubscriptionId, object: "subscription", status: "canceled" },
    },
  };
};

const signed = (body: Record<string, unknown>) => {
  const payload = JSON.stringify(body);
  return { payload, signature: stripe.webhooks.generateTestHeaderString({ payload, secret }) };
};

describeBillingWebhookVerifierContract("StripeWebhookVerifier", () => ({
  verifier: new StripeWebhookVerifier(stripe, secret),
  sign: (event) => signed(stripeEventFor(event)),
  signIgnored: () =>
    signed({
      id: "evt_ignored",
      object: "event",
      type: "invoice.paid",
      created: 0,
      data: { object: {} },
    }),
}));
