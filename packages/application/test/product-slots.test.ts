import {
  createPlausibleConnection,
  enableAutopilot,
  productId,
  type Product,
  type ProductId,
  type Workspace,
} from "@nuvantre/domain";
import { aCampaign, aContentItem, aProduct, aTask } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import {
  ArchiveProduct,
  BuildDueReports,
  CreateProduct,
  DraftSeoArticle,
  DraftSocialWeek,
  GenerateBrief,
  GenerateLaunchKit,
  GenerateWeeklyReport,
  GetProductLineup,
  PlanSeoContent,
  PublishContentItem,
  PublishDueContent,
  RestoreProduct,
  RunAutopilotNow,
  RunDueLoops,
  RunWeeklyLoop,
  SchedulePost,
  SetAutopilot,
  SwapActiveProduct,
  WeeklyReportBuilder,
} from "../src";
import { makeWorld, signedUp, type World } from "./world";

const day = (n: number) => new Date(Date.UTC(2026, 3, n));

/** A Free workspace (1 product) holding A (oldest, active) and B (paused), e.g. after a downgrade. */
const setUp = async () => {
  const world = makeWorld();
  const { workspace } = await signedUp(world);
  const product = (id: string, created: number) =>
    aProduct({ id: productId(id), workspaceId: workspace.id, name: id, createdAt: day(created) });
  const a = product("A", 1);
  const b = product("B", 2);
  await Promise.all([a, b].map((p) => world.products.save(p)));
  return { world, workspace, a, b };
};
type Setup = Awaited<ReturnType<typeof setUp>>;

const PAUSED = {
  code: "product_paused",
  message:
    "B is paused: the Free plan includes 1 product. Upgrade, or archive or pause another product.",
};

/** A task and an approved item of the product, for the use cases that start from one. */
const workOf = async (world: World, product: Product) => {
  const campaign = aCampaign({ id: `camp_${product.id}` as never, productId: product.id });
  const task = aTask({ id: `task_${product.id}` as never, campaignId: campaign.id });
  const item = aContentItem({
    id: `item_${product.id}` as never,
    productId: product.id,
    taskId: task.id,
    channel: "x",
    status: "approved",
  });
  await world.campaigns.save(campaign);
  await world.tasks.save(task);
  await world.contentItems.save(item);
  return { task, item };
};

const guarded: readonly [
  string,
  (s: Setup, product: Product, workspace: Workspace) => Promise<unknown>,
][] = [
  [
    "drafting a brief",
    (s, p, workspace) => new GenerateBrief(s.world).execute({ workspace, productId: p.id }),
  ],
  [
    "planning SEO articles",
    (s, p, workspace) =>
      new PlanSeoContent(s.world).execute({ workspace, productId: p.id, seeds: ["analytics"] }),
  ],
  [
    "drafting an article",
    async (s, p, workspace) =>
      new DraftSeoArticle(s.world).execute({
        workspace,
        taskId: (await workOf(s.world, p)).task.id,
      }),
  ],
  [
    "drafting a social week",
    (s, p, workspace) => new DraftSocialWeek(s.world).execute({ workspace, productId: p.id }),
  ],
  [
    "generating a launch kit",
    (s, p, workspace) => new GenerateLaunchKit(s.world).execute({ workspace, productId: p.id }),
  ],
  [
    "publishing now",
    async (s, p, workspace) =>
      new PublishContentItem(s.world).execute({
        workspace,
        itemId: (await workOf(s.world, p)).item.id,
      }),
  ],
  [
    "scheduling a post",
    async (s, p, workspace) =>
      new SchedulePost(s.world).execute({
        workspace,
        itemId: (await workOf(s.world, p)).item.id,
        publishAt: day(20),
      }),
  ],
  [
    "running the autopilot now",
    (s, p, workspace) =>
      new RunAutopilotNow({ ...s.world, loop: new RunWeeklyLoop(s.world) }).execute({
        workspace,
        productId: p.id,
      }),
  ],
  [
    "switching the autopilot on",
    (s, p, workspace) =>
      new SetAutopilot(s.world).execute({ workspace, productId: p.id, enabled: true }),
  ],
  [
    "building a weekly report",
    (s, p, workspace) =>
      new GenerateWeeklyReport({ ...s.world, builder: new WeeklyReportBuilder(s.world) }).execute({
        workspace,
        productId: p.id,
      }),
  ],
];

describe("a paused product", () => {
  it.each(guarded)("is refused %s, with how to free it", async (_case, run) => {
    const s = await setUp();
    expect(await run(s, s.b, s.workspace)).toEqual({ ok: false, error: PAUSED });
  });

  it("is refused even when it is the one archived, until it is restored", async () => {
    const s = await setUp();
    await new ArchiveProduct(s.world).execute({ workspace: s.workspace, productId: s.a.id });
    // With A archived, B takes the free slot.
    expect(
      await new SetAutopilot(s.world).execute({
        workspace: s.workspace,
        productId: s.b.id,
        enabled: true,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await new GenerateBrief(s.world).execute({ workspace: s.workspace, productId: s.a.id }),
    ).toEqual({
      ok: false,
      error: {
        code: "product_archived",
        message: "A is archived. Restore it to work on it again.",
      },
    });
  });

  it("can still switch its autopilot off", async () => {
    const s = await setUp();
    await s.world.products.save(enableAutopilot(s.b, day(3)));
    expect(
      await new SetAutopilot(s.world).execute({
        workspace: s.workspace,
        productId: s.b.id,
        enabled: false,
      }),
    ).toMatchObject({ ok: true, value: { autopilotSince: null } });
  });

  it("leaves the active product working", async () => {
    const s = await setUp();
    expect(
      await new SetAutopilot(s.world).execute({
        workspace: s.workspace,
        productId: s.a.id,
        enabled: true,
      }),
    ).toMatchObject({ ok: true, value: { autopilotSince: s.world.clock.now() } });
  });
});

describe("the weekly jobs", () => {
  it("run the autopilot only for active products", async () => {
    const s = await setUp();
    await Promise.all([s.a, s.b].map((p) => s.world.products.save(enableAutopilot(p, day(3)))));
    s.world.clock.set(new Date("2026-05-04T07:00:00.000Z"));
    const result = await new RunDueLoops({
      ...s.world,
      loop: new RunWeeklyLoop(s.world),
    }).execute();
    expect(result).toEqual({ ran: 1, skipped: 1 });
    expect(await s.world.autopilotRuns.latestForProduct(s.b.id)).toBeUndefined();
  });

  it("build weekly reports only for active products", async () => {
    const s = await setUp();
    for (const p of [s.a, s.b]) {
      const connection = createPlausibleConnection({
        id: `an_${p.id}` as never,
        productId: p.id,
        siteId: "acme.dev",
        baseUrl: "https://plausible.io",
        encryptedSecret: "v1:iv:tag:ct",
        now: day(1),
      });
      if (!connection.ok) throw new Error(connection.error.message);
      await s.world.analyticsConnections.save(connection.value);
    }
    s.world.clock.set(new Date("2026-05-04T07:00:00.000Z"));
    const result = await new BuildDueReports({
      ...s.world,
      builder: new WeeklyReportBuilder(s.world),
    }).execute();
    expect(result).toEqual({ built: 1, skipped: 1 });
    expect(await s.world.weeklyReports.listByProduct(s.b.id)).toEqual([]);
  });

  it("hold a paused product's due posts instead of failing them, and publish them once active", async () => {
    const s = await setUp();
    const due = (id: string, product: Product) => ({
      ...aContentItem({
        id: id as never,
        productId: product.id,
        channel: "x",
        status: "scheduled",
      }),
      publishAt: day(1),
    });
    s.world.xPublisher.connect(s.a.id).connect(s.b.id);
    await s.world.contentItems.save(due("item_a", s.a));
    await s.world.contentItems.save(due("item_b", s.b));
    const publish = () => new PublishDueContent(s.world).execute();
    expect(await publish()).toEqual({ published: 1, retrying: 0, failed: 0, held: 1 });
    expect((await s.world.contentItems.findById("item_b" as never))?.status).toBe("scheduled");

    await new ArchiveProduct(s.world).execute({ workspace: s.workspace, productId: s.a.id });
    expect(await publish()).toEqual({ published: 1, retrying: 0, failed: 0, held: 0 });
  });
});

describe("archive, restore and swap", () => {
  const archive = (s: Setup, id: ProductId, workspace = s.workspace) =>
    new ArchiveProduct(s.world).execute({ workspace, productId: id });
  const restore = (s: Setup, id: ProductId, workspace = s.workspace) =>
    new RestoreProduct(s.world).execute({ workspace, productId: id });
  const lineup = (s: Setup) => new GetProductLineup(s.world).execute(s.workspace);

  it("lists active products, then paused ones, then archived ones, with the plan", async () => {
    const s = await setUp();
    await archive(s, s.b.id);
    const c = aProduct({
      id: productId("C"),
      workspaceId: s.workspace.id,
      name: "C",
      createdAt: day(3),
    });
    await s.world.products.save(c);
    expect(await lineup(s)).toMatchObject({
      plan: { id: "free" },
      active: [{ id: "A" }],
      paused: [{ id: "C" }],
      archived: [{ id: "B", archivedAt: s.world.clock.now() }],
    });
  });

  it("archiving frees a slot for a new product", async () => {
    const s = await setUp();
    const create = () =>
      new CreateProduct(s.world).execute({
        workspace: s.workspace,
        name: "C",
        url: "https://c.dev",
      });
    expect(await create()).toMatchObject({ ok: false, error: { code: "plan_limit_reached" } });
    await archive(s, s.b.id);
    expect(await create()).toMatchObject({ ok: false, error: { code: "plan_limit_reached" } });
    await archive(s, s.a.id);
    expect(await create()).toMatchObject({ ok: true });
  });

  it("restores only into a free slot", async () => {
    const s = await setUp();
    await archive(s, s.b.id);
    expect(await restore(s, s.b.id)).toEqual({
      ok: false,
      error: {
        code: "no_free_slot",
        message:
          "The Free plan includes 1 product, all in use. Upgrade, or archive another product first.",
      },
    });
    await archive(s, s.a.id);
    expect(await restore(s, s.b.id)).toMatchObject({ ok: true, value: { archivedAt: null } });
    expect((await lineup(s)).active).toMatchObject([{ id: "B" }]);
  });

  it("makes a paused product active in place of an active one", async () => {
    const s = await setUp();
    const result = await new SwapActiveProduct(s.world).execute({
      workspace: s.workspace,
      activate: s.b.id,
      pause: s.a.id,
    });
    expect(result).toMatchObject({ ok: true });
    expect(await lineup(s)).toMatchObject({ active: [{ id: "B" }], paused: [{ id: "A" }] });
  });

  it("refuses a swap that is not a paused product for an active one", async () => {
    const s = await setUp();
    const swap = (activate: ProductId, pause: ProductId) =>
      new SwapActiveProduct(s.world).execute({ workspace: s.workspace, activate, pause });
    expect(await swap(s.a.id, s.b.id)).toEqual({
      ok: false,
      error: {
        code: "invalid_swap",
        message: "Choose a paused product to make active in place of an active one",
      },
    });
  });

  it("refuses another workspace's products", async () => {
    const s = await setUp();
    const other = (await signedUp(s.world, "other@acme.dev")).workspace;
    const notFound = { ok: false, error: { code: "product_not_found" } };
    expect(await archive(s, s.a.id, other)).toMatchObject(notFound);
    expect(await restore(s, s.a.id, other)).toMatchObject(notFound);
    expect(
      await new SwapActiveProduct(s.world).execute({
        workspace: other,
        activate: s.b.id,
        pause: s.a.id,
      }),
    ).toMatchObject(notFound);
  });
});
