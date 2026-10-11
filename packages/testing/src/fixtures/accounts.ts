import {
  applyBillingEvent,
  createUser,
  freeSubscription,
  parseEmail,
  startSession,
  userId,
  workspaceId,
  type PlanId,
  type Session,
  type Subscription,
  type SubscriptionStatus,
  type User,
  type UserId,
  type WorkspaceId,
} from "@launchpilot/domain";
import { fixtureNow, unwrap } from "./entities";

export const aUser = (
  overrides: Partial<{ id: UserId; email: string; passwordHash: string }> = {},
): User =>
  createUser({
    id: overrides.id ?? userId("user_founder"),
    email: unwrap(parseEmail(overrides.email ?? "founder@acme.dev")),
    passwordHash: overrides.passwordHash ?? "stored-password-hash",
    now: fixtureNow,
  });

export const aSession = (
  overrides: Partial<{ token: string; userId: UserId; now: Date }> = {},
): Session =>
  startSession({
    token: overrides.token ?? "session-token-".padEnd(43, "0"),
    userId: overrides.userId ?? userId("user_founder"),
    now: overrides.now ?? fixtureNow,
  });

/** A subscription in the given state, reached through real billing events. */
export const aSubscription = (
  overrides: Partial<{ workspaceId: WorkspaceId; plan: PlanId; status: SubscriptionStatus }> = {},
): Subscription => {
  const ws = overrides.workspaceId ?? workspaceId("ws_1");
  const plan = overrides.plan ?? "free";
  const free = freeSubscription(ws, fixtureNow);
  if (plan === "free") return free;
  const paid = applyBillingEvent(free, {
    type: "subscription_activated",
    workspaceId: ws,
    plan,
    providerCustomerId: `cus_${ws}`,
    providerSubscriptionId: `sub_${ws}`,
    currentPeriodEnd: null,
    occurredAt: fixtureNow,
  });
  const status = overrides.status ?? "active";
  return status === "active"
    ? paid
    : applyBillingEvent(paid, {
        type: "subscription_updated",
        providerSubscriptionId: `sub_${ws}`,
        plan,
        status,
        currentPeriodEnd: null,
        occurredAt: fixtureNow,
      });
};
