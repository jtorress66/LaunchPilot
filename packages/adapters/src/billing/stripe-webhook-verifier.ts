import {
  err,
  ok,
  workspaceId,
  type BillingEvent,
  type Result,
  type SubscriptionStatus,
} from "@nuvantre/domain";
import type { BillingError, BillingWebhookVerifier } from "@nuvantre/ports";
import type Stripe from "stripe";
import { planForLookupKey } from "./stripe-plans";

type Mapped = Result<BillingEvent | null, BillingError>;

const misconfigured = (message: string): Mapped =>
  err({ code: "misconfigured", message, retryable: false });

/** Only active (or trialing) and past-due subscriptions keep a paid plan; anything unpaid loses it. */
const statusFor = (status: Stripe.Subscription.Status): SubscriptionStatus => {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due") return "past_due";
  return "canceled";
};

const idOf = (value: string | { id: string } | null): string | null =>
  typeof value === "string" ? value : (value?.id ?? null);

const fromSeconds = (seconds: number | null | undefined) =>
  typeof seconds === "number" ? new Date(seconds * 1000) : null;

const handlers: Partial<Record<Stripe.Event.Type, (event: Stripe.Event) => Mapped>> = {
  "checkout.session.completed": (event) => {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription") return ok(null);
    if (session.payment_status === "unpaid") return ok(null);
    const plan = session.metadata?.plan;
    const workspace = session.metadata?.workspace_id;
    const customer = idOf(session.customer);
    const subscription = idOf(session.subscription);
    if (!workspace || (plan !== "starter" && plan !== "growth") || !customer || !subscription) {
      return misconfigured("Checkout session is missing Nuvantre metadata");
    }
    return ok({
      type: "subscription_activated",
      workspaceId: workspaceId(workspace),
      plan,
      providerCustomerId: customer,
      providerSubscriptionId: subscription,
      currentPeriodEnd: null,
      occurredAt: new Date(event.created * 1000),
    });
  },
  "customer.subscription.updated": (event) => {
    const subscription = event.data.object as Stripe.Subscription;
    const item = subscription.items.data[0];
    const plan = planForLookupKey(item?.price.lookup_key);
    if (!plan) return misconfigured(`Unknown Stripe price "${item?.price.lookup_key ?? "none"}"`);
    return ok({
      type: "subscription_updated",
      providerSubscriptionId: subscription.id,
      plan,
      status: statusFor(subscription.status),
      currentPeriodEnd: fromSeconds(item?.current_period_end),
      occurredAt: new Date(event.created * 1000),
    });
  },
  "customer.subscription.deleted": (event) =>
    ok({
      type: "subscription_canceled",
      providerSubscriptionId: (event.data.object as Stripe.Subscription).id,
      occurredAt: new Date(event.created * 1000),
    }),
};

/** Verifies Stripe's signature header, then maps the few events Nuvantre acts on. */
export class StripeWebhookVerifier implements BillingWebhookVerifier {
  constructor(
    private readonly stripe: Stripe,
    private readonly webhookSecret: string,
  ) {}

  async verify(payload: string, signature: string): Promise<Mapped> {
    let event: Stripe.Event;
    try {
      event = await this.stripe.webhooks.constructEventAsync(
        payload,
        signature,
        this.webhookSecret,
      );
    } catch {
      return err({
        code: "invalid_signature",
        message: "Stripe signature is invalid",
        retryable: false,
      });
    }
    const handler = handlers[event.type];
    return handler ? handler(event) : ok(null);
  }
}
