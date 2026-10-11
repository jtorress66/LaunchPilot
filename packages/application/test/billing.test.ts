import {
  effectivePlan,
  workspaceId as wsId,
  type BillingEvent,
  type WorkspaceId,
} from "@launchpilot/domain";
import { FakeWebhookVerifier } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { HandleBillingWebhook, StartCheckout } from "../src";
import { makeWorld, signedUp, type World } from "./world";

describe("StartCheckout", () => {
  it("asks the provider for a checkout for the founder's workspace and returns its URL", async () => {
    const world = makeWorld();
    const { user, workspace } = await signedUp(world);
    const result = await new StartCheckout(world).execute({ user, workspace, plan: "starter" });
    expect(result).toEqual({
      ok: true,
      value: { url: `https://checkout.test/${workspace.id}/starter` },
    });
    expect(world.checkout.requests).toEqual([
      {
        workspaceId: workspace.id,
        plan: "starter",
        email: user.email,
        successUrl: "https://app.launchpilot.test/app/billing?checkout=success",
        cancelUrl: "https://app.launchpilot.test/app/billing?checkout=canceled",
      },
    ]);
  });

  it("refuses to sell the Free plan", async () => {
    const world = makeWorld();
    const { user, workspace } = await signedUp(world);
    const result = await new StartCheckout(world).execute({ user, workspace, plan: "free" });
    expect(result.ok ? undefined : result.error.code).toBe("plan_not_purchasable");
    expect(world.checkout.requests).toEqual([]);
  });

  it("reports a provider failure without throwing", async () => {
    const world = makeWorld();
    const { user, workspace } = await signedUp(world);
    world.checkout.failNext({ code: "provider_error", message: "Stripe is down", retryable: true });
    const result = await new StartCheckout(world).execute({ user, workspace, plan: "growth" });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "billing_failed",
        message: "Checkout is unavailable right now. Please try again.",
      },
    });
  });
});

const deliver = (world: World, event: BillingEvent) =>
  new HandleBillingWebhook(world).execute(FakeWebhookVerifier.sign(event));

describe("HandleBillingWebhook", () => {
  const activation = (world: World, workspaceId: WorkspaceId) =>
    ({
      type: "subscription_activated",
      workspaceId,
      plan: "starter",
      providerCustomerId: "cus_1",
      providerSubscriptionId: "sub_1",
      currentPeriodEnd: null,
      occurredAt: world.clock.now(),
    }) as const;

  it("upgrades the workspace when a subscription is activated", async () => {
    const world = makeWorld();
    const { workspace } = await signedUp(world);
    expect(await deliver(world, activation(world, workspace.id))).toEqual({
      ok: true,
      value: { handled: true },
    });
    const sub = await world.subscriptions.findByWorkspace(workspace.id);
    expect(sub && effectivePlan(sub, world.clock.now())).toBe("starter");
  });

  it("ends up in the same state when the same event is delivered twice", async () => {
    const world = makeWorld();
    const { workspace } = await signedUp(world);
    await deliver(world, activation(world, workspace.id));
    const once = await world.subscriptions.findByWorkspace(workspace.id);
    await deliver(world, activation(world, workspace.id));
    expect(await world.subscriptions.findByWorkspace(workspace.id)).toEqual(once);
  });

  it("returns the workspace to Free when the subscription is canceled", async () => {
    const world = makeWorld();
    const { workspace } = await signedUp(world);
    await deliver(world, activation(world, workspace.id));
    world.clock.advance(1000);
    await deliver(world, {
      type: "subscription_canceled",
      providerSubscriptionId: "sub_1",
      occurredAt: world.clock.now(),
    });
    const sub = await world.subscriptions.findByWorkspace(workspace.id);
    expect(sub && effectivePlan(sub, world.clock.now())).toBe("free");
  });

  it("refuses a webhook with a bad signature", async () => {
    const world = makeWorld();
    const result = await new HandleBillingWebhook(world).execute({
      payload: "{}",
      signature: "forged",
    });
    expect(result.ok ? undefined : result.error.code).toBe("invalid_signature");
  });

  it("acknowledges an event type it does not act on", async () => {
    const world = makeWorld();
    const result = await new HandleBillingWebhook(world).execute(FakeWebhookVerifier.signIgnored());
    expect(result).toEqual({ ok: true, value: { handled: false } });
  });

  it("reports an activation for an unknown workspace", async () => {
    const world = makeWorld();
    const result = await deliver(world, activation(world, wsId("ws_missing")));
    expect(result.ok ? undefined : result.error.code).toBe("workspace_not_found");
  });

  it("reports an update for a subscription it has not seen yet, so the provider retries later", async () => {
    const world = makeWorld();
    const result = await deliver(world, {
      type: "subscription_canceled",
      providerSubscriptionId: "sub_unknown",
      occurredAt: world.clock.now(),
    });
    expect(result.ok ? undefined : result.error.code).toBe("subscription_not_found");
  });
});
