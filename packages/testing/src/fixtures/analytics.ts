import {
  analyticsConnectionId,
  buildWeeklyReport,
  chooseGoogleProperties,
  createGoogleConnection,
  createPlausibleConnection,
  productId,
  weeklyReportId,
  type GoogleConnection,
  type MetricsSnapshot,
  type PlausibleConnection,
  type ProductId,
  type ReportWeek,
  type SourceResult,
  type WeeklyReport,
} from "@launchpilot/domain";
import { fixtureNow, unwrap } from "./entities";

/** The week before `fixtureNow` (a Monday): 29 Dec 2025 – 5 Jan 2026. */
export const aReportWeek = (): ReportWeek => ({
  start: new Date("2025-12-29T00:00:00.000Z"),
  end: new Date("2026-01-05T00:00:00.000Z"),
});

export const aGoogleConnection = (
  overrides: Partial<{
    id: string;
    productId: ProductId;
    searchConsoleSite: string | null;
    ga4PropertyId: string | null;
  }> = {},
): GoogleConnection =>
  unwrap(
    chooseGoogleProperties(
      unwrap(
        createGoogleConnection({
          id: analyticsConnectionId(overrides.id ?? "an_google"),
          productId: overrides.productId ?? productId("prod_1"),
          accountEmail: "founder@acme.dev",
          encryptedSecret: "v1:fixture-refresh-token",
          now: fixtureNow,
        }),
      ),
      {
        searchConsoleSite:
          overrides.searchConsoleSite === undefined
            ? "sc-domain:acme.dev"
            : overrides.searchConsoleSite,
        ga4PropertyId:
          overrides.ga4PropertyId === undefined ? "123456789" : overrides.ga4PropertyId,
      },
    ),
  );

export const aPlausibleConnection = (
  overrides: Partial<{ id: string; productId: ProductId; siteId: string }> = {},
): PlausibleConnection =>
  unwrap(
    createPlausibleConnection({
      id: analyticsConnectionId(overrides.id ?? "an_plausible"),
      productId: overrides.productId ?? productId("prod_1"),
      siteId: overrides.siteId ?? "acme.dev",
      baseUrl: "https://plausible.io",
      encryptedSecret: "v1:fixture-api-key",
      now: fixtureNow,
    }),
  );

export const aSnapshot = (overrides: Partial<MetricsSnapshot> = {}): MetricsSnapshot => ({
  source: "search_console",
  from: aReportWeek().start,
  to: aReportWeek().end,
  values: { search_clicks: 120, search_impressions: 4000, search_ctr: 0.03, search_position: 14.2 },
  topPages: [],
  topQueries: [{ query: "cookieless analytics", clicks: 40, impressions: 900, position: 3.1 }],
  ...overrides,
});

const results = (): SourceResult[] => [
  {
    source: "search_console",
    outcome: {
      kind: "ok",
      current: aSnapshot(),
      previous: aSnapshot({ values: { search_clicks: 100, search_impressions: 3800 } }),
    },
  },
  {
    source: "ga4",
    outcome: {
      kind: "ok",
      current: aSnapshot({
        source: "ga4",
        values: { visitors: 1200, pageviews: 3100 },
        topPages: [
          { url: "/", visitors: 700 },
          { url: "/pricing", visitors: 210 },
        ],
        topQueries: [],
      }),
      previous: aSnapshot({ source: "ga4", values: { visitors: 1000, pageviews: 2900 } }),
    },
  },
  { source: "plausible", outcome: { kind: "not_connected" } },
];

export const aWeeklyReport = (
  overrides: Partial<{
    id: string;
    productId: ProductId;
    week: ReportWeek;
    results: readonly SourceResult[];
    now: Date;
  }> = {},
): WeeklyReport =>
  buildWeeklyReport({
    id: weeklyReportId(overrides.id ?? "rep_1"),
    productId: overrides.productId ?? productId("prod_1"),
    week: overrides.week ?? aReportWeek(),
    results: overrides.results ?? results(),
    now: overrides.now ?? fixtureNow,
  });
