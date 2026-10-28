import {
  contentItemId,
  setProductLocale,
  transition,
  userId,
  type Product,
  type User,
  type Workspace,
} from "@nuvantre/domain";
import { aContentItem, aWeeklyReport } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { FakeContentDrafter } from "@nuvantre/testing";
import {
  DrafterRegistry,
  ApproveBrief,
  CreateProduct,
  GenerateBrief,
  GetAutopilotStatus,
  RunAutopilotNow,
  RunDueLoops,
  RunWeeklyLoop,
  SetAutopilot,
} from "../src";
import { makeWorld, signedUp, type World, ownerAccess } from "./world";

interface Setup {
  world: World;
  workspace: Workspace;
  user: User;
  product: Product;
}

/** The world's clock is Friday 1 May 2026: the loop plans the week of Monday 27 April. */
const loopWeek = {
  start: new Date("2026-04-27T00:00:00.000Z"),
  end: new Date("2026-05-04T00:00:00.000Z"),
};
const reportWeek = {
  start: new Date("2026-04-20T00:00:00.000Z"),
  end: new Date("2026-04-27T00:00:00.000Z"),
};

const IDEAS = [
  { keyword: "cookieless analytics", monthlySearches: 480, difficulty: 12 },
  { keyword: "gdpr analytics tool", monthlySearches: 320, difficulty: 18 },
  { keyword: "way too hard keyword", monthlySearches: 9000, difficulty: 95 },
];

const setUp = async ({ approve = true, email = "founder@acme.dev" } = {}, world = makeWorld()) => {
  const { workspace, user } = await signedUp(world, email);
  const created = await new CreateProduct(world).execute({
    workspace,
    name: "Acme Analytics",
    url: "https://acme.dev",
  });
  if (!created.ok) throw new Error(created.error.message);
  const product = created.value;
  world.crawler.addSite(product.url, [
    { url: product.url, title: "Acme", text: "Free 14-day trial.\nGDPR compliant." },
  ]);
  world.keywords.setIdeas(IDEAS);
  await new GenerateBrief(world).execute({ workspace, productId: product.id });
  const setup = { world, workspace, user, product };
  if (approve) await approveBrief(setup);
  return setup;
};

const approveBrief = (s: Setup) =>
  new ApproveBrief(s.world).execute({
    access: ownerAccess(s.workspace),
    productId: s.product.id,
  });

const loop = (world: World) => new RunWeeklyLoop(world);
const runNow = (s: Setup, workspace = s.workspace) =>
  new RunAutopilotNow({ ...s.world, loop: loop(s.world) }).execute({
    workspace,
    productId: s.product.id,
  });
const inReview = async (s: Setup) =>
  (await s.world.contentItems.listByProduct(s.product.id)).filter((i) => i.status === "in_review");

const ranOk = async (s: Setup) => {
  const result = await runNow(s);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("RunWeeklyLoop", () => {
  it("plans, drafts and reviews the week, leaving every item in review for the founder", async () => {
    const s = await setUp();
    const run = await ranOk(s);
    expect(run).toMatchObject({
      productId: s.product.id,
      week: loopWeek,
      outcome: {
        kind: "completed",
        summary: {
          planned: 7,
          dropped: 0,
          drafted: 7,
          redrafted: 0,
          failed: 0,
          stoppedAtLimit: false,
        },
      },
    });
    const items = await inReview(s);
    expect(items.map((i) => i.channel).sort()).toEqual(
      ["blog", "blog", "linkedin", "linkedin", "x", "x", "x"].sort(),
    );
    for (const item of items) {
      expect(item.agentReview).toMatchObject({ decision: "pass", redrafted: false });
      expect(item.approval).toBeNull();
    }
  });

  it("offers the strategist only realistic keywords and brief angles, with the allowance and last week's report", async () => {
    const s = await setUp();
    const report = aWeeklyReport({ productId: s.product.id, week: reportWeek });
    await s.world.weeklyReports.save(report);
    await ranOk(s);
    const [request] = s.world.planner.requests;
    expect(request?.lastWeek).toEqual(report);
    expect(request?.allowance).toBe(10);
    expect(request?.candidates.keywords.map((k) => k.keyword)).toEqual([
      "cookieless analytics",
      "gdpr analytics tool",
    ]);
    expect(request?.candidates.angles.length).toBe(5);
    // Last week's top searches seed the keyword research, next to the brief's differentiators.
    expect(s.world.keywords.queries[0]?.seeds).toContain("cookieless analytics");
  });

  it("seeds keyword research from the brief's problem for a brand-new product", async () => {
    const s = await setUp();
    await ranOk(s);
    // The drafted brief has no differentiators and there is no report yet.
    expect(s.world.keywords.queries[0]?.seeds).toEqual(["A problem described on the site"]);
  });

  it("redrafts once with the reviewer's blockers, and stores the second verdict", async () => {
    const s = await setUp();
    s.world.reviewer.respondOnce(
      {
        decision: "needs_changes",
        issues: [{ severity: "blocker", message: "Cites a fact not in the brief" }],
      },
      { decision: "pass", issues: [] },
    );
    const run = await ranOk(s);
    expect(run.outcome).toMatchObject({ summary: { redrafted: 1, drafted: 7 } });
    expect(s.world.writer.requests[1]?.revisionNote).toContain("Cites a fact not in the brief");
    const redrafted = (await inReview(s)).filter((i) => i.agentReview?.redrafted);
    expect(redrafted).toHaveLength(1);
    expect(redrafted[0]?.agentReview?.decision).toBe("pass");
  });

  it("still puts a draft the redraft could not fix in front of the founder, flagged", async () => {
    const s = await setUp();
    s.world.reviewer.respondWith({
      decision: "needs_changes",
      issues: [{ severity: "blocker", message: "Over-promises" }],
    });
    await ranOk(s);
    const items = await inReview(s);
    expect(items).toHaveLength(7);
    expect(
      items.every((i) => i.agentReview?.decision === "needs_changes" && i.agentReview.redrafted),
    ).toBe(true);
  });

  it("plans only what the monthly allowance still allows", async () => {
    const s = await setUp();
    for (let i = 0; i < 8; i++) {
      await s.world.contentItems.save({
        ...aContentItem({ id: contentItemId(`used_${String(i)}`) }),
        productId: s.product.id,
        createdAt: s.world.clock.now(),
      });
    }
    const run = await ranOk(s);
    expect(s.world.planner.requests[0]?.allowance).toBe(2);
    expect(run.outcome).toMatchObject({ summary: { drafted: 2, stoppedAtLimit: false } });
  });

  it("keeps going when one draft fails, and counts it", async () => {
    const s = await setUp();
    s.world.writer.failNext({ code: "unavailable", message: "Busy", retryable: true });
    const run = await ranOk(s);
    expect(run.outcome).toMatchObject({ summary: { drafted: 6, failed: 1 } });
  });

  it("stores no review when the reviewer is down, but the item still reaches the Inbox", async () => {
    const s = await setUp();
    s.world.reviewer.failNext({ code: "unavailable", message: "Down", retryable: true });
    await ranOk(s);
    const items = await inReview(s);
    expect(items).toHaveLength(7);
    expect(items.filter((i) => i.agentReview === null)).toHaveLength(1);
  });

  it("writes and reviews the week in the product's language, and links articles only to published ones", async () => {
    const s = await setUp();
    const portuguese = setProductLocale(s.product, "pt-BR");
    if (!portuguese.ok) throw new Error(portuguese.error.message);
    await s.world.products.save(portuguese.value);
    const now = { now: s.world.clock.now() };
    const live = [
      { type: "submit" },
      { type: "approve", actor: { kind: "founder", userId: userId("user_1") } },
      { type: "markPublished", externalUrl: "https://blog.acme.dev/guia" },
    ].reduce(
      (item, event) => {
        const next = transition(item, event as never, now);
        if (!next.ok) throw new Error(next.error.message);
        return next.value;
      },
      aContentItem({ id: contentItemId("item_published"), productId: s.product.id }),
    );
    await s.world.contentItems.save(live);

    await ranOk(s);
    const brazil = { language: "pt", market: "BR" };
    expect(s.world.keywords.queries[0]?.locale).toEqual(brazil);
    expect(s.world.writer.requests[0]).toMatchObject({
      locale: brazil,
      internalLinks: [{ title: live.title, url: "https://blog.acme.dev/guia" }],
    });
    expect(s.world.socialWriter.requests[0]?.locale).toEqual(brazil);
    expect(s.world.reviewer.requests.every((r) => r.locale?.language === "pt")).toBe(true);
    const article = (await inReview(s)).find((i) => i.channel === "blog");
    expect(article?.seo?.slug).toEqual(expect.any(String));
  });

  it("plans from the brief's angles alone when keyword research fails", async () => {
    const s = await setUp();
    s.world.keywords.failNext({ code: "unavailable", message: "Down", retryable: true });
    await ranOk(s);
    expect(s.world.planner.requests[0]?.candidates.keywords).toEqual([]);
    expect((await inReview(s)).every((i) => i.channel !== "blog")).toBe(true);
  });

  it("records a failed run when the strategist cannot plan", async () => {
    const s = await setUp();
    s.world.planner.failNext({ code: "unavailable", message: "Model busy", retryable: true });
    expect(await ranOk(s)).toMatchObject({ outcome: { kind: "failed", reason: "Model busy" } });
    expect(await inReview(s)).toEqual([]);
  });

  it("records the plan's dropped tasks", async () => {
    const s = await setUp();
    s.world.planner.respondWith({
      name: "Week",
      goal: "Goal",
      tasks: [
        {
          kind: "seo_article",
          channel: "blog",
          title: "Invented",
          rationale: "r",
          keyword: "best tool 2027",
        },
        {
          kind: "seo_article",
          channel: "blog",
          title: "Real",
          rationale: "r",
          keyword: "cookieless analytics",
        },
      ],
    });
    expect((await ranOk(s)).outcome).toMatchObject({
      summary: { planned: 1, dropped: 1, drafted: 1 },
    });
  });
});

describe("DrafterRegistry", () => {
  it("refuses two writers for one channel", () => {
    const drafter = new FakeContentDrafter();
    expect(
      () =>
        new DrafterRegistry([
          { channel: "x", drafter },
          { channel: "x", drafter },
        ]),
    ).toThrow(/exactly one drafter/);
  });

  it("counts a task as failed when no writer is registered for its channel", async () => {
    const s = await setUp();
    const onlyBlog = new DrafterRegistry([{ channel: "blog", drafter: s.world.writer }]);
    const run = await new RunAutopilotNow({
      ...s.world,
      loop: new RunWeeklyLoop({ ...s.world, drafters: onlyBlog }),
    }).execute({ workspace: s.workspace, productId: s.product.id });
    expect(run.ok && run.value.outcome).toMatchObject({ summary: { drafted: 2, failed: 5 } });
  });
});

describe("RunAutopilotNow", () => {
  it("skips, without planning, until the brief is approved, then runs on the next try", async () => {
    const s = await setUp({ approve: false });
    expect(await ranOk(s)).toMatchObject({
      outcome: { kind: "skipped", reason: "Approve the Product Brief first" },
    });
    expect(s.world.planner.requests).toEqual([]);
    await approveBrief(s);
    expect((await ranOk(s)).outcome.kind).toBe("completed");
  });

  it("runs a completed week only once", async () => {
    const s = await setUp();
    const first = await ranOk(s);
    const again = await ranOk(s);
    expect(again).toEqual(first);
    expect(await inReview(s)).toHaveLength(7);
    expect(s.world.planner.requests).toHaveLength(1);
  });

  it("refuses another workspace's product", async () => {
    const s = await setUp();
    const other = await signedUp(s.world, "other@acme.dev");
    expect(await runNow(s, other.workspace)).toMatchObject({
      ok: false,
      error: { code: "product_not_found" },
    });
  });
});

describe("SetAutopilot and GetAutopilotStatus", () => {
  it("switches the autopilot on and off, and shows the latest run", async () => {
    const s = await setUp();
    const input = { workspace: s.workspace, productId: s.product.id };
    const status = () => new GetAutopilotStatus(s.world).execute(input);
    expect(await status()).toEqual({ ok: true, value: { enabledSince: null, latest: null } });

    await new SetAutopilot(s.world).execute({ ...input, enabled: true });
    const run = await ranOk(s);
    expect(await status()).toEqual({
      ok: true,
      value: { enabledSince: s.world.clock.now(), latest: run },
    });
    await new SetAutopilot(s.world).execute({ ...input, enabled: false });
    expect((await s.world.products.findById(s.product.id))?.autopilotSince).toBeNull();
  });
});

describe("RunDueLoops", () => {
  const due = (world: World) => new RunDueLoops({ ...world, loop: loop(world) }).execute();
  const autopilotOn = (s: Setup) =>
    new SetAutopilot(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
      enabled: true,
    });

  it("waits until Monday 07:00 UTC, after the weekly reports", async () => {
    const s = await setUp();
    await autopilotOn(s);
    s.world.clock.set(new Date("2026-05-04T06:59:00.000Z"));
    expect(await due(s.world)).toEqual({ ran: 0, skipped: 0 });
    s.world.clock.set(new Date("2026-05-04T07:00:00.000Z"));
    expect(await due(s.world)).toEqual({ ran: 1, skipped: 0 });
    expect(s.world.planner.requests[0]?.week.start).toEqual(new Date("2026-05-04T00:00:00.000Z"));
  });

  it("runs only products with autopilot on, once per week, even after a failed run", async () => {
    const world = makeWorld();
    const on = await setUp({}, world);
    await autopilotOn(on);
    await setUp({ email: "off@acme.dev" }, world);
    world.planner.failNext({ code: "unavailable", message: "Busy", retryable: true });
    expect(await due(world)).toEqual({ ran: 1, skipped: 0 });
    expect(await due(world)).toEqual({ ran: 0, skipped: 1 });
    expect(world.planner.requests).toHaveLength(1);
  });

  it("runs at most 10 products per pass", async () => {
    const world = makeWorld();
    for (let i = 0; i < 12; i++)
      await autopilotOn(await setUp({ email: `f${String(i)}@acme.dev` }, world));
    expect(await due(world)).toEqual({ ran: 10, skipped: 0 });
    expect(await due(world)).toEqual({ ran: 2, skipped: 10 });
  });
});
