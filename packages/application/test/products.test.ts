import { describe, expect, it } from "vitest";
import { CreateProduct, GetDashboard } from "../src";
import { makeWorld, signedUp, type World } from "./world";
import { FakeWebhookVerifier, InMemorySubscriptionRepository } from "@launchpilot/testing";
import { HandleBillingWebhook } from "../src";
import type { Workspace } from "@launchpilot/domain";

const upgrade = async (world: World, workspace: Workspace, plan: "starter" | "growth") => {
  const { payload, signature } = FakeWebhookVerifier.sign({
    type: "subscription_activated",
    workspaceId: workspace.id,
    plan,
    providerCustomerId: "cus_1",
    providerSubscriptionId: "sub_1",
    currentPeriodEnd: null,
    occurredAt: world.clock.now(),
  });
  const result = await new HandleBillingWebhook(world).execute({ payload, signature });
  if (!result.ok) throw new Error(result.error.message);
};

describe("CreateProduct", () => {
  it("adds a product to the founder's workspace", async () => {
    const world = makeWorld();
    const { workspace } = await signedUp(world);
    const result = await new CreateProduct(world).execute({
      workspace,
      name: "Acme",
      url: "acme.dev",
    });
    expect(result.ok ? undefined : result.error.code).toBe("invalid_url");

    const created = await new CreateProduct(world).execute({
      workspace,
      name: " Acme Analytics ",
      url: "https://acme.dev",
    });
    if (!created.ok) throw new Error(created.error.message);
    expect(created.value).toMatchObject({
      workspaceId: workspace.id,
      name: "Acme Analytics",
      url: "https://acme.dev/",
    });
    expect(await world.products.listByWorkspace(workspace.id)).toEqual([created.value]);
  });

  it("stops a Free workspace at its first product", async () => {
    const world = makeWorld();
    const { workspace } = await signedUp(world);
    const create = new CreateProduct(world);
    await create.execute({ workspace, name: "One", url: "https://one.dev" });
    const second = await create.execute({ workspace, name: "Two", url: "https://two.dev" });
    expect(second).toEqual({
      ok: false,
      error: {
        code: "plan_limit_reached",
        message: "The Free plan includes 1 product. Upgrade to add more.",
      },
    });
  });

  it("lets a Growth workspace add three products", async () => {
    const world = makeWorld();
    const { workspace } = await signedUp(world);
    await upgrade(world, workspace, "growth");
    const create = new CreateProduct(world);
    for (const name of ["One", "Two", "Three"]) {
      const result = await create.execute({
        workspace,
        name,
        url: `https://${name.toLowerCase()}.dev`,
      });
      expect(result.ok).toBe(true);
    }
    const fourth = await create.execute({ workspace, name: "Four", url: "https://four.dev" });
    expect(fourth.ok ? undefined : fourth.error.code).toBe("plan_limit_reached");
  });
});

describe("GetDashboard", () => {
  it("shows the plan, its limits and current usage", async () => {
    const world = makeWorld();
    const { workspace } = await signedUp(world);
    await new CreateProduct(world).execute({ workspace, name: "Acme", url: "https://acme.dev" });
    const dashboard = await new GetDashboard(world).execute(workspace);
    expect(dashboard).toMatchObject({
      workspace,
      plan: { id: "free", name: "Free", limits: { products: 1 } },
      subscriptionStatus: "active",
      usage: { products: 1 },
      canAddProduct: false,
    });
    expect(dashboard.products.map((p) => p.name)).toEqual(["Acme"]);
  });

  it("reflects an upgrade", async () => {
    const world = makeWorld();
    const { workspace } = await signedUp(world);
    await upgrade(world, workspace, "growth");
    const dashboard = await new GetDashboard(world).execute(workspace);
    expect(dashboard).toMatchObject({ plan: { id: "growth" }, canAddProduct: true });
  });

  it("treats a workspace without a subscription record as Free", async () => {
    const world = makeWorld();
    const { workspace } = await signedUp(world);
    const withoutRecord = { ...world, subscriptions: new InMemorySubscriptionRepository() };
    const dashboard = await new GetDashboard(withoutRecord).execute(workspace);
    expect(dashboard.plan.id).toBe("free");
  });
});
