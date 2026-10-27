// Build step 9 gate: a weekly report built correctly from recorded API data.
// Real adapters (Search Console, GA4, Plausible), real Postgres and real encryption; only
// Google's and Plausible's HTTP APIs are replaced by their recorded responses.
import {
  AesGcmTokenCipher,
  createDatabase,
  createPostgresRepositories,
  migrateDown,
  migrateToLatest,
} from "@nuvantre/adapters";
import {
  aGoogleConnection,
  aPlausibleConnection,
  aProduct,
  aUser,
  aWorkspace,
} from "@nuvantre/testing";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import ga4PagesW41 from "../../../packages/adapters/test/google/recorded/ga4-pages-w41.json";
import ga4PagesW42 from "../../../packages/adapters/test/google/recorded/ga4-pages-w42.json";
import ga4TotalsW41 from "../../../packages/adapters/test/google/recorded/ga4-totals-w41.json";
import ga4TotalsW42 from "../../../packages/adapters/test/google/recorded/ga4-totals-w42.json";
import gscQueriesW41 from "../../../packages/adapters/test/google/recorded/gsc-queries-w41.json";
import gscQueriesW42 from "../../../packages/adapters/test/google/recorded/gsc-queries-w42.json";
import gscTotalsW41 from "../../../packages/adapters/test/google/recorded/gsc-totals-w41.json";
import gscTotalsW42 from "../../../packages/adapters/test/google/recorded/gsc-totals-w42.json";
import tokenRefresh from "../../../packages/adapters/test/google/recorded/token-refresh.json";
import plausiblePagesW41 from "../../../packages/adapters/test/plausible/recorded/pages-w41.json";
import plausiblePagesW42 from "../../../packages/adapters/test/plausible/recorded/pages-w42.json";
import plausibleTotalsW41 from "../../../packages/adapters/test/plausible/recorded/totals-w41.json";
import plausibleTotalsW42 from "../../../packages/adapters/test/plausible/recorded/totals-w42.json";
import type { PublisherConfig, ReportsConfig } from "../src/config";
import { createWeeklyReports } from "../src/container";

const KEY = Buffer.alloc(32, 9).toString("base64");
const REFRESH = "1//recorded-refresh-token";
const PLAUSIBLE_KEY = "plausible-recorded-key";
const W42 = {
  start: new Date("2026-10-12T00:00:00.000Z"),
  end: new Date("2026-10-19T00:00:00.000Z"),
};

const publisher: PublisherConfig = {
  connectionString: inject("databaseUrl"),
  tokenEncryptionKey: KEY,
  allowPrivateNetwork: false,
  intervalMs: 60_000,
  zernio: { apiKey: "sk_unused", baseUrl: null },
  blogs: { webflowApiBaseUrl: null, wixApiBaseUrl: null },
};
const reports: ReportsConfig = {
  intervalMs: 3_600_000,
  google: { clientId: "recorded-client", clientSecret: "recorded-secret", baseUrl: null },
  analyst: { kind: "template" },
};

/** The recorded response for the week a request asks about (W42, or W41 before it). */
const byWeek = (startDate: string, w42: JsonBodyType, w41: JsonBodyType) =>
  HttpResponse.json(startDate === "2026-10-12" ? w42 : w41);

const server = setupServer(
  http.post("https://oauth2.googleapis.com/token", async ({ request }) => {
    const form = new URLSearchParams(await request.text());
    return form.get("refresh_token") === REFRESH
      ? HttpResponse.json(tokenRefresh)
      : HttpResponse.json({ error: "invalid_grant" }, { status: 400 });
  }),
  http.post(
    "https://www.googleapis.com/webmasters/v3/sites/:site/searchAnalytics/query",
    async ({ request }) => {
      const body = (await request.json()) as { startDate: string; dimensions?: string[] };
      return body.dimensions
        ? byWeek(body.startDate, gscQueriesW42, gscQueriesW41)
        : byWeek(body.startDate, gscTotalsW42, gscTotalsW41);
    },
  ),
  http.post(
    "https://analyticsdata.googleapis.com/v1beta/properties/:report",
    async ({ request }) => {
      const body = (await request.json()) as {
        dateRanges: { startDate: string }[];
        dimensions?: unknown[];
      };
      const start = body.dateRanges[0]?.startDate ?? "";
      return body.dimensions
        ? byWeek(start, ga4PagesW42, ga4PagesW41)
        : byWeek(start, ga4TotalsW42, ga4TotalsW41);
    },
  ),
  http.post("https://plausible.io/api/v2/query", async ({ request }) => {
    if (request.headers.get("authorization") !== `Bearer ${PLAUSIBLE_KEY}`) {
      return HttpResponse.json({ error: "Invalid API key." }, { status: 401 });
    }
    const body = (await request.json()) as { date_range: string[]; dimensions?: string[] };
    const start = body.date_range[0] ?? "";
    return body.dimensions
      ? byWeek(start, plausiblePagesW42, plausiblePagesW41)
      : byWeek(start, plausibleTotalsW42, plausibleTotalsW41);
  }),
);

const db = createDatabase(inject("databaseUrl"));
const repos = createPostgresRepositories(db);
const cipher = new AesGcmTokenCipher(KEY);
const weekly = createWeeklyReports(publisher, reports);

beforeAll(async () => {
  server.listen({ onUnhandledRequest: "error" });
  await migrateDown(db);
  await migrateToLatest(db);
  await repos.users.save(aUser());
  await repos.workspaces.save(aWorkspace());
  await repos.products.save(aProduct());
  const google = aGoogleConnection({
    searchConsoleSite: "sc-domain:acme.dev",
    ga4PropertyId: "412345678",
  });
  await repos.analyticsConnections.save({
    ...google,
    encryptedSecret: await cipher.encrypt(REFRESH),
  });
  await repos.analyticsConnections.save({
    ...aPlausibleConnection(),
    encryptedSecret: await cipher.encrypt(PLAUSIBLE_KEY),
  });
});

afterAll(async () => {
  server.close();
  await weekly.close();
  await db.destroy();
});

describe("weekly report from recorded API data", () => {
  it("merges Search Console, GA4 and Plausible into the expected report and stores it", async () => {
    const product = aProduct();
    const built = await weekly.builder.build(product, W42);

    expect(built).toMatchObject({
      productId: product.id,
      week: W42,
      weekKey: "2026-W42",
      sources: [
        { source: "search_console", status: "ok", reason: null },
        { source: "ga4", status: "ok", reason: null },
        { source: "plausible", status: "ok", reason: null },
      ],
      notesError: null,
    });
    // GA4 is preferred over Plausible for visitors and pageviews; changes are against W41.
    expect(built.metrics).toEqual([
      { name: "visitors", value: 1432, previous: 1265, change: 0.132, source: "ga4" },
      { name: "pageviews", value: 3876, previous: 3502, change: 0.1068, source: "ga4" },
      {
        name: "search_clicks",
        value: 182,
        previous: 151,
        change: 0.2053,
        source: "search_console",
      },
      {
        name: "search_impressions",
        value: 6240,
        previous: 5980,
        change: 0.0435,
        source: "search_console",
      },
      {
        name: "search_ctr",
        value: 182 / 6240,
        previous: 151 / 5980,
        change: 0.1551,
        source: "search_console",
      },
      {
        name: "search_position",
        value: 17.43,
        previous: 18.9,
        change: -0.0778,
        source: "search_console",
      },
    ]);
    expect(built.topPages).toEqual([
      { url: "/", visitors: 812 },
      { url: "/pricing", visitors: 233 },
      { url: "/blog/cookieless-analytics", visitors: 198 },
      { url: "/docs/setup", visitors: 87 },
    ]);
    expect(built.topQueries).toEqual([
      { query: "cookieless analytics", clicks: 41, impressions: 820, position: 4.2 },
      { query: "privacy friendly analytics", clicks: 27, impressions: 1110, position: 8.7 },
      { query: "gdpr analytics tool", clicks: 19, impressions: 640, position: 6.1 },
      { query: "plausible alternative", clicks: 12, impressions: 930, position: 11.4 },
    ]);
    expect(built.notes).toEqual({
      summary: "Search clicks rose 21% to 182 compared with the week before.",
      highlights: ['"/" had 812 visitors.', '"cookieless analytics" brought 41 search clicks.'],
      suggestions: ['Write a post that answers "cookieless analytics".'],
    });

    expect(await repos.weeklyReports.findByProductAndWeek(product.id, "2026-W42")).toEqual(built);
  });

  it("rebuilds the same week in place", async () => {
    const product = aProduct();
    const first = await repos.weeklyReports.findByProductAndWeek(product.id, "2026-W42");
    const again = await weekly.builder.build(product, W42);
    expect(again.id).toBe(first?.id);
    expect(await repos.weeklyReports.listByProduct(product.id)).toHaveLength(1);
  });
});
