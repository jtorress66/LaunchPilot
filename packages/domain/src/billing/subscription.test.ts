import { describe, expect, it } from "vitest";
import { workspaceId } from "../shared/ids";
import {
  applyBillingEvent,
  effectivePlan,
  freeSubscription,
  type BillingEvent,
  type Subscription,
} from "./subscription";

const ws = workspaceId("ws_1");
const t0 = new Date("2026-05-01T00:00:00.000Z");
const t1 = new Date("2026-05-02T00:00:00.000Z");
const t2 = new Date("2026-05-03T00:00:00.000Z");
const periodEnd = new Date("2026-06-02T00:00:00.000Z");

const activated: BillingEvent = {
  type: "subscription_activated",
  workspaceId: ws,
  plan: "starter",
  providerCustomerId: "cus_1",
  providerSubscriptionId: "sub_1",
  currentPeriodEnd: null,
  occurredAt: t1,
};

const paid = (): Subscription => applyBillingEvent(freeSubscription(ws, t0), activated);

describe("subscription", () => {
  it("starts every workspace on an active Free plan", () => {
    const sub = freeSubscription(ws, t0);
    expect(sub).toEqual({
      workspaceId: "ws_1",
      plan: "free",
      status: "active",
      providerCustomerId: null,
      providerSubscriptionId: null,
      currentPeriodEnd: null,
      updatedAt: t0,
    });
    expect(effectivePlan(sub, t0)).toBe("free");
  });

  it("switches to the purchased plan when the subscription is activated", () => {
    expect(paid()).toMatchObject({
      plan: "starter",
      status: "active",
      providerCustomerId: "cus_1",
      providerSubscriptionId: "sub_1",
      updatedAt: t1,
    });
    expect(effectivePlan(paid(), t1)).toBe("starter");
  });

  it("applies plan, status and period changes from an update", () => {
    const updated = applyBillingEvent(paid(), {
      type: "subscription_updated",
      providerSubscriptionId: "sub_1",
      plan: "growth",
      status: "active",
      currentPeriodEnd: periodEnd,
      occurredAt: t2,
    });
    expect(updated).toMatchObject({ plan: "growth", currentPeriodEnd: periodEnd, updatedAt: t2 });
  });

  it("keeps the paid plan while a payment is past due", () => {
    const pastDue = applyBillingEvent(paid(), {
      type: "subscription_updated",
      providerSubscriptionId: "sub_1",
      plan: "starter",
      status: "past_due",
      currentPeriodEnd: periodEnd,
      occurredAt: t2,
    });
    expect(effectivePlan(pastDue, t2)).toBe("starter");
  });

  it("falls back to Free once the subscription is canceled", () => {
    const canceled = applyBillingEvent(paid(), {
      type: "subscription_canceled",
      providerSubscriptionId: "sub_1",
      occurredAt: t2,
    });
    expect(canceled.status).toBe("canceled");
    expect(effectivePlan(canceled, t2)).toBe("free");
  });

  it("falls back to Free after the paid period ends", () => {
    const withPeriod = applyBillingEvent(paid(), {
      type: "subscription_updated",
      providerSubscriptionId: "sub_1",
      plan: "starter",
      status: "active",
      currentPeriodEnd: periodEnd,
      occurredAt: t2,
    });
    expect(effectivePlan(withPeriod, new Date(periodEnd.getTime() - 1))).toBe("starter");
    expect(effectivePlan(withPeriod, periodEnd)).toBe("free");
  });

  it("ignores an event older than the last change, so late deliveries cannot undo newer state", () => {
    const sub = paid();
    const stale = applyBillingEvent(sub, {
      type: "subscription_canceled",
      providerSubscriptionId: "sub_1",
      occurredAt: t0,
    });
    expect(stale).toBe(sub);
  });
});
