import { planIds, subscriptionStatuses, workspaceId, type Subscription } from "@launchpilot/domain";
import type { SubscriptionRow } from "../schema";
import { oneOf } from "./columns";

export const subscriptionMapper = {
  toRow: (subscription: Subscription): SubscriptionRow => ({
    workspace_id: subscription.workspaceId,
    plan: subscription.plan,
    status: subscription.status,
    provider_customer_id: subscription.providerCustomerId,
    provider_subscription_id: subscription.providerSubscriptionId,
    current_period_end: subscription.currentPeriodEnd,
    updated_at: subscription.updatedAt,
  }),
  fromRow: (row: SubscriptionRow): Subscription => ({
    workspaceId: workspaceId(row.workspace_id),
    plan: oneOf(planIds, row.plan, "subscriptions.plan"),
    status: oneOf(subscriptionStatuses, row.status, "subscriptions.status"),
    providerCustomerId: row.provider_customer_id,
    providerSubscriptionId: row.provider_subscription_id,
    currentPeriodEnd: row.current_period_end,
    updatedAt: row.updated_at,
  }),
};
