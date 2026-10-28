import {
  briefId,
  enableAutopilot,
  productId,
  type AuditEntry,
  type Product,
} from "@nuvantre/domain";
import {
  aBrief,
  aContentItem,
  aProduct,
  FakePlausibleSiteVerifier,
  FakeWebhookVerifier,
} from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import {
  ApproveBrief,
  ApproveContentItem,
  ArchiveProduct,
  ConnectBlog,
  ConnectPlausible,
  ConnectSocial,
  CreateProduct,
  GetActivity,
  HandleBillingWebhook,
  LogIn,
  PublishContentItem,
  PublishDueContent,
  RefreshSocialLinks,
  RestoreProduct,
  SchedulePost,
  SetAutopilot,
  SwapActiveProduct,
} from "../src";
import { makeWorld, PASSWORD, signedUp, type World, ownerAccess } from "./world";

const setUp = async () => {
  const world = makeWorld();
  const { workspace, user } = await signedUp(world);
  const created = await new CreateProduct(world).execute({
    workspace,
    name: "Acme",
    url: "https://acme.dev",
  });
  if (!created.ok) throw new Error(created.error.message);
  return { world, workspace, user, product: created.value };
};
type Setup = Awaited<ReturnType<typeof setUp>>;

const latest = (world: World): AuditEntry | undefined => world.audit.entries.at(-1);
const founder = (s: Setup) => ({ kind: "founder", userId: s.user.id });

const item = async (s: Setup, status: "in_review" | "approved", channel: "x" | "blog" = "x") => {
  const saved = aContentItem({ productId: s.product.id, status, channel });
  await s.world.contentItems.save(saved);
  return saved;
};

describe("the audit trail records what the founder does", () => {
  it("records creating a product, by the founder, named after the product", async () => {
    const s = await setUp();
    expect(latest(s.world)).toMatchObject({
      workspaceId: s.workspace.id,
      actor: founder(s),
      action: "product_created",
      subject: { kind: "product", id: s.product.id, label: "Acme" },
      at: s.world.clock.now(),
    });
  });

  it("records signing in", async () => {
    const s = await setUp();
    await new LogIn(s.world).execute({ email: "founder@acme.dev", password: PASSWORD });
    expect(latest(s.world)).toMatchObject({
      actor: founder(s),
      action: "signed_in",
      subject: { kind: "account", id: s.user.id, label: "founder@acme.dev" },
    });
  });

  it("records archiving, restoring and making a product active", async () => {
    const s = await setUp();
    const input = { workspace: s.workspace, productId: s.product.id };
    await new ArchiveProduct(s.world).execute(input);
    expect(latest(s.world)).toMatchObject({
      action: "product_archived",
      subject: { id: s.product.id },
    });
    await new RestoreProduct(s.world).execute(input);
    expect(latest(s.world)).toMatchObject({ action: "product_restored" });

    const other: Product = {
      ...aProduct({ id: productId("prod_b"), workspaceId: s.workspace.id, name: "Beta" }),
      slotOrder: new Date("2030-01-01T00:00:00.000Z"),
    };
    await s.world.products.save(other);
    await new SwapActiveProduct(s.world).execute({
      workspace: s.workspace,
      activate: other.id,
      pause: s.product.id,
    });
    expect(latest(s.world)).toMatchObject({
      action: "product_activated",
      subject: { kind: "product", id: "prod_b", label: "Beta" },
    });
  });

  it("records approving the brief and an item, with the approving founder", async () => {
    const s = await setUp();
    await s.world.briefs.save(aBrief({ id: briefId("brief_1"), productId: s.product.id }));
    await new ApproveBrief(s.world).execute({
      access: ownerAccess(s.workspace),
      productId: s.product.id,
    });
    expect(latest(s.world)).toMatchObject({
      actor: founder(s),
      action: "brief_approved",
      subject: { kind: "brief", id: "brief_1", label: "Acme" },
    });

    const toApprove = await item(s, "in_review");
    await new ApproveContentItem(s.world).execute({
      access: ownerAccess(s.workspace),
      itemId: toApprove.id,
    });
    expect(latest(s.world)).toMatchObject({
      action: "content_approved",
      subject: { kind: "content", id: toApprove.id, label: toApprove.title },
    });
  });

  it("records publishing now and scheduling, by the founder", async () => {
    const s = await setUp();
    s.world.xPublisher.connect(s.product.id);
    const now = await item(s, "approved");
    await new PublishContentItem(s.world).execute({
      access: ownerAccess(s.workspace),
      itemId: now.id,
    });
    expect(latest(s.world)).toMatchObject({ actor: founder(s), action: "content_published" });

    const later = { ...(await item(s, "approved")), id: "item_later" as never };
    await s.world.contentItems.save(later);
    await new SchedulePost(s.world).execute({
      access: ownerAccess(s.workspace),
      itemId: later.id,
      publishAt: new Date("2030-01-01T09:00:00.000Z"),
    });
    expect(latest(s.world)).toMatchObject({
      action: "post_scheduled",
      subject: { id: "item_later" },
    });
  });

  it("records the scheduler publishing a due post as the system", async () => {
    const s = await setUp();
    s.world.xPublisher.connect(s.product.id);
    await s.world.contentItems.save({
      ...aContentItem({ productId: s.product.id, channel: "x", status: "scheduled" }),
      publishAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await new PublishDueContent(s.world).execute();
    expect(latest(s.world)).toMatchObject({
      workspaceId: s.workspace.id,
      actor: { kind: "system" },
      action: "content_published",
    });
  });

  it("records connecting a blog, social accounts and analytics, named by site or service", async () => {
    const s = await setUp();
    const blog = {
      platform: "wordpress" as const,
      siteUrl: "https://blog.acme.dev",
      settings: { username: "admin" },
      secret: "app password",
    };
    s.world.blogVerifier.accept(blog, "Acme Blog");
    await new ConnectBlog(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
      ...blog,
    });
    expect(latest(s.world)).toMatchObject({
      action: "blog_connected",
      subject: { kind: "connection", label: "Acme Blog" },
    });

    await new ConnectSocial(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
      channel: "x",
      returnUrl: "https://app.nuvantre.test/back",
    });
    s.world.linker.link("zp_fake_1", [{ channel: "x", accountId: "acc_x" }]);
    await new RefreshSocialLinks(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
    });
    expect(latest(s.world)).toMatchObject({ action: "social_connected", subject: { label: "X" } });

    const valid = FakePlausibleSiteVerifier.valid;
    await new ConnectPlausible(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
      siteId: valid.siteId,
      apiKey: valid.apiKey,
      baseUrl: null,
    });
    expect(latest(s.world)).toMatchObject({
      action: "analytics_connected",
      subject: { kind: "connection", label: "Plausible" },
    });
  });

  it("records switching the autopilot on and off", async () => {
    const s = await setUp();
    const input = { workspace: s.workspace, productId: s.product.id };
    await new SetAutopilot(s.world).execute({ ...input, enabled: true });
    expect(latest(s.world)).toMatchObject({ action: "autopilot_enabled" });
    await s.world.products.save(enableAutopilot(s.product, s.world.clock.now()));
    await new SetAutopilot(s.world).execute({ ...input, enabled: false });
    expect(latest(s.world)).toMatchObject({ action: "autopilot_disabled" });
  });

  it("records a plan change from billing as the system", async () => {
    const s = await setUp();
    const { payload, signature } = FakeWebhookVerifier.sign({
      type: "subscription_activated",
      workspaceId: s.workspace.id,
      plan: "growth",
      providerCustomerId: "cus_1",
      providerSubscriptionId: "sub_1",
      currentPeriodEnd: null,
      occurredAt: s.world.clock.now(),
    });
    await new HandleBillingWebhook(s.world).execute({ payload, signature });
    expect(latest(s.world)).toMatchObject({
      actor: { kind: "system" },
      action: "plan_changed",
      subject: { kind: "plan", id: "growth", label: "Growth" },
    });
  });

  it("records nothing when the action fails", async () => {
    const s = await setUp();
    const before = s.world.audit.entries.length;
    const other = (await signedUp(s.world, "other@acme.dev")).workspace;
    const after = s.world.audit.entries.length;
    await new ArchiveProduct(s.world).execute({ workspace: other, productId: s.product.id });
    await new LogIn(s.world).execute({ email: "founder@acme.dev", password: "wrong password" });
    expect(s.world.audit.entries).toHaveLength(after);
    expect(after).toBe(before);
  });

  it("still completes the action when the trail cannot record, and reports why", async () => {
    const s = await setUp();
    const failing = {
      ...s.world,
      audit: {
        record: () => Promise.reject(new Error("audit table locked")),
        listByWorkspace: () => Promise.resolve([]),
      },
    };
    const result = await new ArchiveProduct(failing).execute({
      workspace: s.workspace,
      productId: s.product.id,
    });
    expect(result).toMatchObject({ ok: true });
    expect(s.world.errors.reports).toMatchObject([
      { context: { workspaceId: s.workspace.id }, error: { message: "audit table locked" } },
    ]);
  });
});

describe("GetActivity", () => {
  it("pages the workspace's history, newest first, 50 at a time", async () => {
    const s = await setUp();
    for (let i = 0; i < 60; i++) {
      s.world.clock.advance(1_000);
      await new SetAutopilot(s.world).execute({
        workspace: s.workspace,
        productId: s.product.id,
        enabled: i % 2 === 0,
      });
    }
    const first = await new GetActivity(s.world).execute({ workspace: s.workspace });
    expect(first.entries).toHaveLength(50);
    expect(first.entries[0]?.at).toEqual(s.world.clock.now());
    expect(first.nextBefore).toEqual(first.entries.at(-1)?.at);
    const next = await new GetActivity(s.world).execute({
      workspace: s.workspace,
      ...(first.nextBefore ? { before: first.nextBefore } : {}),
    });
    // The 10 remaining toggles plus creating the product.
    expect(next.entries).toHaveLength(11);
    expect(next.nextBefore).toBeNull();
  });

  it("names the people behind the entries on the page", async () => {
    const s = await setUp();
    const page = await new GetActivity(s.world).execute({ workspace: s.workspace });
    expect(page.people).toEqual({ [s.user.id]: "founder@acme.dev" });
  });
});
