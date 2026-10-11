import type { WorkspaceId } from "../shared/ids";
import type { PlanId } from "./plans";

export const subscriptionStatuses = ["active", "past_due", "canceled"] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export interface Subscription {
  readonly workspaceId: WorkspaceId;
  readonly plan: PlanId;
  readonly status: SubscriptionStatus;
  readonly providerCustomerId: string | null;
  readonly providerSubscriptionId: string | null;
  readonly currentPeriodEnd: Date | null;
  readonly updatedAt: Date;
}

/** Provider-neutral billing facts, produced by a BillingWebhookVerifier adapter. */
export type BillingEvent =
  | {
      readonly type: "subscription_activated";
      readonly workspaceId: WorkspaceId;
      readonly plan: PlanId;
      readonly providerCustomerId: string;
      readonly providerSubscriptionId: string;
      readonly currentPeriodEnd: Date | null;
      readonly occurredAt: Date;
    }
  | {
      readonly type: "subscription_updated";
      readonly providerSubscriptionId: string;
      readonly plan: PlanId;
      readonly status: SubscriptionStatus;
      readonly currentPeriodEnd: Date | null;
      readonly occurredAt: Date;
    }
  | {
      readonly type: "subscription_canceled";
      readonly providerSubscriptionId: string;
      readonly occurredAt: Date;
    };

export const freeSubscription = (workspaceId: WorkspaceId, now: Date): Subscription => ({
  workspaceId,
  plan: "free",
  status: "active",
  providerCustomerId: null,
  providerSubscriptionId: null,
  currentPeriodEnd: null,
  updatedAt: now,
});

type Changes<K extends BillingEvent["type"]> = (
  event: Extract<BillingEvent, { type: K }>,
) => Partial<Subscription>;

const changes: { readonly [K in BillingEvent["type"]]: Changes<K> } = {
  subscription_activated: (e) => ({
    plan: e.plan,
    status: "active",
    providerCustomerId: e.providerCustomerId,
    providerSubscriptionId: e.providerSubscriptionId,
    currentPeriodEnd: e.currentPeriodEnd,
  }),
  subscription_updated: (e) => ({
    plan: e.plan,
    status: e.status,
    currentPeriodEnd: e.currentPeriodEnd,
  }),
  subscription_canceled: () => ({ status: "canceled" }),
};

/** Applies a billing event. Events older than the last change are ignored (webhooks can arrive late). */
export const applyBillingEvent = (
  subscription: Subscription,
  event: BillingEvent,
): Subscription => {
  if (event.occurredAt.getTime() < subscription.updatedAt.getTime()) return subscription;
  // TypeScript cannot correlate `changes[event.type]` with `event`; the mapped type guarantees it.
  const change = changes[event.type] as Changes<BillingEvent["type"]>;
  return { ...subscription, ...change(event), updatedAt: event.occurredAt };
};

/** The plan whose limits apply right now. */
export const effectivePlan = (subscription: Subscription, now: Date): PlanId => {
  if (subscription.status === "canceled") return "free";
  const lapsed =
    subscription.currentPeriodEnd !== null &&
    now.getTime() >= subscription.currentPeriodEnd.getTime();
  return lapsed ? "free" : subscription.plan;
};
