import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { StripeWebhookVerifier } from "./stripe-webhook-verifier";

const secret = "whsec_test_unit";
const stripe = new Stripe("sk_test_offline", { httpClient: Stripe.createFetchHttpClient() });
const verifier = new StripeWebhookVerifier(stripe, secret);

const deliver = (body: Record<string, unknown>) => {
  const payload = JSON.stringify({ id: "evt_1", object: "event", created: 1_780_000_000, ...body });
  return verifier.verify(payload, stripe.webhooks.generateTestHeaderString({ payload, secret }));
};

const subscriptionUpdate = (status: string, lookupKey = "launchpilot_starter_monthly") => ({
  type: "customer.subscription.updated",
  data: {
    object: {
      id: "sub_1",
      status,
      items: { data: [{ price: { lookup_key: lookupKey }, current_period_end: 1_782_000_000 }] },
    },
  },
});

describe("StripeWebhookVerifier mapping", () => {
  it.each([
    ["active", "active"],
    ["trialing", "active"],
    ["past_due", "past_due"],
    ["unpaid", "canceled"],
    ["incomplete", "canceled"],
    ["incomplete_expired", "canceled"],
    ["paused", "canceled"],
    ["canceled", "canceled"],
  ])(
    "treats a Stripe %s subscription as %s, never granting a plan before payment",
    async (stripeStatus, status) => {
      const result = await deliver(subscriptionUpdate(stripeStatus));
      expect(result).toMatchObject({ ok: true, value: { type: "subscription_updated", status } });
    },
  );

  it("ignores a completed checkout that has not been paid", async () => {
    const result = await deliver({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          payment_status: "unpaid",
          customer: "cus_1",
          subscription: "sub_1",
          metadata: { workspace_id: "ws_1", plan: "starter" },
        },
      },
    });
    expect(result).toEqual({ ok: true, value: null });
  });

  it("reports a price whose lookup key it does not know as a configuration problem", async () => {
    const result = await deliver(subscriptionUpdate("active", "someone_elses_price"));
    expect(result).toMatchObject({ ok: false, error: { code: "misconfigured" } });
  });

  it("reports a completed checkout without LaunchPilot metadata as a configuration problem", async () => {
    const result = await deliver({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          payment_status: "paid",
          customer: "cus_1",
          subscription: "sub_1",
          metadata: {},
        },
      },
    });
    expect(result).toMatchObject({ ok: false, error: { code: "misconfigured" } });
  });
});
