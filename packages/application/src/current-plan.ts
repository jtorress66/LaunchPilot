import {
  effectivePlan,
  freeSubscription,
  type Subscription,
  type Workspace,
} from "@nuvantre/domain";
import type { Clock, SubscriptionRepository } from "@nuvantre/ports";

/** The workspace's subscription, treating a missing record as Free. */
export const loadSubscription = async (
  deps: { readonly subscriptions: SubscriptionRepository; readonly clock: Clock },
  workspace: Workspace,
): Promise<Subscription> =>
  (await deps.subscriptions.findByWorkspace(workspace.id)) ??
  freeSubscription(workspace.id, deps.clock.now());

export const currentPlan = async (
  deps: { readonly subscriptions: SubscriptionRepository; readonly clock: Clock },
  workspace: Workspace,
) => effectivePlan(await loadSubscription(deps, workspace), deps.clock.now());
