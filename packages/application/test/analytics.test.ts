import type { Product, User, Workspace } from "@launchpilot/domain";
import { FakeAnalyticsPropertyLister, FakePlausibleSiteVerifier } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import {
  ApproveBrief,
  BuildDueReports,
  ChooseAnalyticsProperties,
  CompleteGoogleConnect,
  ConnectPlausible,
  CreateProduct,
  DisconnectAnalytics,
  GenerateBrief,
  GenerateWeeklyReport,
  GetAnalyticsOverview,
  GetWeeklyReport,
  ListAnalyticsProperties,
  StartGoogleConnect,
  WeeklyReportBuilder,
} from "../src";
import { makeWorld, signedUp, type World } from "./world";

interface Setup {
  world: World;
  workspace: Workspace;
  user: User;
  product: Product;
}

const HOUR = 60 * 60 * 1000;
/** The world's clock is Friday 1 May 2026, so the last complete week is 20–27 April. */
const lastWeek = {
  start: new Date("2026-04-20T00:00:00.000Z"),
  end: new Date("2026-04-27T00:00:00.000Z"),
};
const weekBefore = new Date("2026-04-13T00:00:00.000Z");

const createProduct = async (world: World, workspace: Workspace, name = "Acme Analytics") => {
  const created = await new CreateProduct(world).execute({
    workspace,
    name,
    url: "https://acme.dev",
  });
  if (!created.ok) throw new Error(created.error.message);
  return created.value;
};

const setUp = async (): Promise<Setup> => {
  const world = makeWorld();
  const { workspace, user } = await signedUp(world);
  const product = await createProduct(world, workspace);
  return { world, workspace, user, product };
};

const connectGoogle = async ({ world, workspace, product }: Setup) => {
  const started = await new StartGoogleConnect(world).execute({ workspace, productId: product.id });
  if (!started.ok) throw new Error(started.error.message);
  const done = await new CompleteGoogleConnect(world).execute({
    workspace,
    productId: product.id,
    code: world.googleAuth.issueCode(),
    state: started.value.state,
    expectedState: started.value.state,
  });
  if (!done.ok) throw new Error(done.error.message);
  return started.value;
};

/** The Free plan allows one product, so each extra product gets its own founder. */
const anotherFounder = async (setup: Setup, n: number, connected: boolean) => {
  const { workspace, user } = await signedUp(setup.world, `founder${String(n)}@acme.dev`);
  const product = await createProduct(setup.world, workspace, `Product ${String(n)}`);
  if (connected) await connectGoogle({ world: setup.world, workspace, user, product });
};

const builder = (world: World) => new WeeklyReportBuilder(world);
const generate = (setup: Setup) =>
  new GenerateWeeklyReport({ ...setup.world, builder: builder(setup.world) }).execute({
    workspace: setup.workspace,
    productId: setup.product.id,
  });

describe("connecting Google", () => {
  it("sends the founder to Google with a fresh state and the app's callback", async () => {
    const setup = await setUp();
    const result = await new StartGoogleConnect(setup.world).execute({
      workspace: setup.workspace,
      productId: setup.product.id,
    });
    if (!result.ok) throw new Error(result.error.message);
    const url = new URL(result.value.url);
    expect(url.searchParams.get("state")).toBe(result.value.state);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.launchpilot.test/api/google/callback",
    );
    expect(result.value.state).toMatch(/^token_/);
  });

  it("stores the refresh token encrypted and names the account, with no properties yet", async () => {
    const setup = await setUp();
    await connectGoogle(setup);
    const stored = await setup.world.analyticsConnections.find(setup.product.id, "google");
    expect(stored).toMatchObject({
      accountEmail: "founder@acme.dev",
      searchConsoleSite: null,
      ga4PropertyId: null,
    });
    expect(stored?.encryptedSecret).not.toContain("fake-refresh-token");
    expect(await setup.world.cipher.decrypt(stored?.encryptedSecret ?? "")).toBe(
      "fake-refresh-token",
    );
  });

  it("refuses a callback whose state does not match, before calling Google", async () => {
    const setup = await setUp();
    const code = setup.world.googleAuth.issueCode();
    const result = await new CompleteGoogleConnect(setup.world).execute({
      workspace: setup.workspace,
      productId: setup.product.id,
      code,
      state: "forged",
      expectedState: "token_1",
    });
    expect(result).toMatchObject({ ok: false, error: { code: "oauth_state_mismatch" } });
    expect(await setup.world.analyticsConnections.listByProduct(setup.product.id)).toEqual([]);
  });

  it("passes on Google's refusal of an expired code", async () => {
    const setup = await setUp();
    const result = await new CompleteGoogleConnect(setup.world).execute({
      workspace: setup.workspace,
      productId: setup.product.id,
      code: "expired",
      state: "s",
      expectedState: "s",
    });
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_grant" } });
  });

  it("keeps the chosen properties when the same account connects again", async () => {
    const setup = await setUp();
    await connectGoogle(setup);
    await new ChooseAnalyticsProperties(setup.world).execute({
      workspace: setup.workspace,
      productId: setup.product.id,
      searchConsoleSite: "sc-domain:acme.dev",
      ga4PropertyId: null,
    });
    await connectGoogle(setup);
    expect(await setup.world.analyticsConnections.find(setup.product.id, "google")).toMatchObject({
      searchConsoleSite: "sc-domain:acme.dev",
    });
  });

  it("refuses another workspace's product", async () => {
    const setup = await setUp();
    const other = await signedUp(setup.world, "other@acme.dev");
    const result = await new StartGoogleConnect(setup.world).execute({
      workspace: other.workspace,
      productId: setup.product.id,
    });
    expect(result).toMatchObject({ ok: false, error: { code: "product_not_found" } });
  });
});

describe("choosing Google properties", () => {
  it("lists the account's properties with the current choice", async () => {
    const setup = await setUp();
    await connectGoogle(setup);
    expect(
      await new ListAnalyticsProperties(setup.world).execute({
        workspace: setup.workspace,
        productId: setup.product.id,
      }),
    ).toEqual({
      ok: true,
      value: {
        properties: new FakeAnalyticsPropertyLister().properties,
        chosen: { searchConsoleSite: null, ga4PropertyId: null },
      },
    });
  });

  it("needs a Google connection first", async () => {
    const setup = await setUp();
    expect(
      await new ListAnalyticsProperties(setup.world).execute({
        workspace: setup.workspace,
        productId: setup.product.id,
      }),
    ).toMatchObject({ ok: false, error: { code: "analytics_not_connected" } });
  });

  it("saves a valid choice and refuses a malformed one", async () => {
    const setup = await setUp();
    await connectGoogle(setup);
    const choose = new ChooseAnalyticsProperties(setup.world);
    const input = { workspace: setup.workspace, productId: setup.product.id };
    expect(
      await choose.execute({ ...input, searchConsoleSite: "acme", ga4PropertyId: null }),
    ).toMatchObject({ ok: false, error: { code: "invalid_url" } });
    expect(
      await choose.execute({ ...input, searchConsoleSite: null, ga4PropertyId: "123456789" }),
    ).toMatchObject({ ok: true });
    expect(await setup.world.analyticsConnections.find(setup.product.id, "google")).toMatchObject({
      ga4PropertyId: "123456789",
    });
  });
});

describe("connecting Plausible", () => {
  const valid = FakePlausibleSiteVerifier.valid;

  it("verifies the site and key, then stores the key encrypted", async () => {
    const setup = await setUp();
    const result = await new ConnectPlausible(setup.world).execute({
      workspace: setup.workspace,
      productId: setup.product.id,
      siteId: valid.siteId,
      apiKey: valid.apiKey,
      baseUrl: null,
    });
    expect(result).toEqual({
      ok: true,
      value: { siteId: "acme.dev", baseUrl: "https://plausible.io/" },
    });
    const stored = await setup.world.analyticsConnections.find(setup.product.id, "plausible");
    expect(await setup.world.cipher.decrypt(stored?.encryptedSecret ?? "")).toBe(valid.apiKey);
  });

  it("stores nothing when Plausible rejects the key", async () => {
    const setup = await setUp();
    const result = await new ConnectPlausible(setup.world).execute({
      workspace: setup.workspace,
      productId: setup.product.id,
      siteId: valid.siteId,
      apiKey: "wrong",
      baseUrl: null,
    });
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_credentials" } });
    expect(await setup.world.analyticsConnections.listByProduct(setup.product.id)).toEqual([]);
  });

  it("refuses a malformed self-hosted address without calling it", async () => {
    const setup = await setUp();
    const result = await new ConnectPlausible(setup.world).execute({
      workspace: setup.workspace,
      productId: setup.product.id,
      siteId: valid.siteId,
      apiKey: valid.apiKey,
      baseUrl: "plausible",
    });
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_url" } });
    expect(setup.world.plausibleVerifier.verified).toEqual([]);
  });

  it("disconnects one provider", async () => {
    const setup = await setUp();
    await connectGoogle(setup);
    await new DisconnectAnalytics(setup.world).execute({
      workspace: setup.workspace,
      productId: setup.product.id,
      provider: "google",
    });
    expect(await setup.world.analyticsConnections.listByProduct(setup.product.id)).toEqual([]);
  });
});

describe("GenerateWeeklyReport", () => {
  const withFigures = (world: World, product: Product) => {
    world.searchConsole.setWeek(lastWeek.start, { search_clicks: 120, search_impressions: 4000 });
    world.searchConsole.setWeek(weekBefore, { search_clicks: 100, search_impressions: 4000 });
    world.ga4.setWeek(
      lastWeek.start,
      { visitors: 1200 },
      { topPages: [{ url: "/", visitors: 700 }] },
    );
    world.ga4.setWeek(weekBefore, { visitors: 1000 });
    world.plausible.disconnect(product.id);
  };

  it("builds last week's report from every source, compared with the week before", async () => {
    const setup = await setUp();
    await connectGoogle(setup);
    withFigures(setup.world, setup.product);
    const result = await generate(setup);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({
      productId: setup.product.id,
      week: lastWeek,
      weekKey: "2026-W17",
      topPages: [{ url: "/", visitors: 700 }],
      sources: [
        { source: "search_console", status: "ok" },
        { source: "ga4", status: "ok" },
        { source: "plausible", status: "not_connected" },
      ],
      notes: { summary: "Notes on Acme Analytics for 2026-W17." },
      notesError: null,
    });
    expect(result.value.metrics.map((m) => [m.name, m.value, m.change])).toEqual([
      ["visitors", 1200, 0.2],
      ["search_clicks", 120, 0.2],
      ["search_impressions", 4000, 0],
    ]);
    expect(setup.world.searchConsole.queries.map((q) => q.from)).toEqual([
      lastWeek.start,
      weekBefore,
    ]);
  });

  it("still builds the report when one source fails, saying which and why", async () => {
    const setup = await setUp();
    await connectGoogle(setup);
    withFigures(setup.world, setup.product);
    setup.world.ga4.failNext({
      code: "no_access",
      message: "Access was removed",
      retryable: false,
    });
    const result = await generate(setup);
    expect(result.ok && result.value.sources[1]).toEqual({
      source: "ga4",
      status: "failed",
      reason: "Access was removed",
    });
  });

  it("gives the analyst the approved brief, and none before approval", async () => {
    const setup = await setUp();
    await connectGoogle(setup);
    await generate(setup);
    expect(setup.world.analyst.requests[0]?.brief).toBeNull();
    setup.world.crawler.addSite(setup.product.url, [
      { url: setup.product.url, title: "Acme", text: "Free 14-day trial." },
    ]);
    await new GenerateBrief(setup.world).execute({
      workspace: setup.workspace,
      productId: setup.product.id,
    });
    await new ApproveBrief(setup.world).execute({
      workspace: setup.workspace,
      productId: setup.product.id,
      actor: { kind: "founder", userId: setup.user.id },
    });
    await generate(setup);
    expect(setup.world.analyst.requests[1]?.brief).not.toBeNull();
  });

  it("saves the report without notes when the analyst fails", async () => {
    const setup = await setUp();
    await connectGoogle(setup);
    setup.world.analyst.failNext({ code: "unavailable", message: "Model busy", retryable: true });
    const result = await generate(setup);
    expect(result).toMatchObject({ ok: true, value: { notes: null, notesError: "Model busy" } });
    expect(
      await setup.world.weeklyReports.findByProductAndWeek(setup.product.id, "2026-W17"),
    ).toMatchObject({ notesError: "Model busy" });
  });

  it("rebuilds the same week in place, keeping one report", async () => {
    const setup = await setUp();
    await connectGoogle(setup);
    const first = await generate(setup);
    setup.world.clock.advance(HOUR);
    const second = await generate(setup);
    expect(second.ok && first.ok && second.value.id).toBe(first.ok && first.value.id);
    expect(await setup.world.weeklyReports.listByProduct(setup.product.id)).toHaveLength(1);
  });

  it("needs at least one analytics connection", async () => {
    const setup = await setUp();
    expect(await generate(setup)).toMatchObject({
      ok: false,
      error: { code: "analytics_not_connected" },
    });
  });
});

describe("BuildDueReports", () => {
  const run = (world: World) =>
    new BuildDueReports({ ...world, builder: builder(world) }).execute();

  it("builds last week's report for each connected product that has none, once", async () => {
    const setup = await setUp();
    await connectGoogle(setup);
    await anotherFounder(setup, 1, true);
    await anotherFounder(setup, 2, false);
    expect(await run(setup.world)).toEqual({ built: 2, skipped: 0 });
    expect(await run(setup.world)).toEqual({ built: 0, skipped: 2 });
  });

  it("waits until 06:00 UTC on Monday so every source has finished the week", async () => {
    const setup = await setUp();
    await connectGoogle(setup);
    setup.world.clock.set(new Date("2026-05-04T05:59:00.000Z"));
    expect(await run(setup.world)).toEqual({ built: 0, skipped: 0 });
    setup.world.clock.set(new Date("2026-05-04T06:00:00.000Z"));
    expect(await run(setup.world)).toEqual({ built: 1, skipped: 0 });
  });

  it("builds at most 20 reports per run", async () => {
    const setup = await setUp();
    for (let i = 1; i <= 22; i++) await anotherFounder(setup, i, true);
    expect(await run(setup.world)).toEqual({ built: 20, skipped: 0 });
    expect(await run(setup.world)).toEqual({ built: 2, skipped: 20 });
  });
});

describe("reading reports", () => {
  it("shows the connections without secrets, and the reports newest first", async () => {
    const setup = await setUp();
    await connectGoogle(setup);
    await generate(setup);
    const result = await new GetAnalyticsOverview(setup.world).execute({
      workspace: setup.workspace,
      productId: setup.product.id,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.google).toEqual({
      accountEmail: "founder@acme.dev",
      searchConsoleSite: null,
      ga4PropertyId: null,
    });
    expect(result.value.plausible).toBeNull();
    expect(result.value.reports.map((r) => r.weekKey)).toEqual(["2026-W17"]);
    expect(result.value.latest?.weekKey).toBe("2026-W17");
    expect(JSON.stringify(result.value)).not.toContain("fake:");
  });

  it("finds one report by week, and refuses an unknown week or another workspace", async () => {
    const setup = await setUp();
    await connectGoogle(setup);
    await generate(setup);
    const get = new GetWeeklyReport(setup.world);
    const input = { workspace: setup.workspace, productId: setup.product.id };
    expect((await get.execute({ ...input, weekKey: "2026-W17" })).ok).toBe(true);
    expect(await get.execute({ ...input, weekKey: "2026-W01" })).toMatchObject({
      ok: false,
      error: { code: "report_not_found" },
    });
    const other = await signedUp(setup.world, "other@acme.dev");
    expect(
      await get.execute({ ...input, workspace: other.workspace, weekKey: "2026-W17" }),
    ).toMatchObject({ ok: false, error: { code: "product_not_found" } });
  });
});
