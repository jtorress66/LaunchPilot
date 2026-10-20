import { describe, expect, it } from "vitest";
import { productId, weeklyReportId } from "../shared/ids";
import type { MetricsSnapshot } from "./metrics";
import {
  buildWeeklyReport,
  withAnalystNotes,
  withoutAnalystNotes,
  type SourceResult,
} from "./weekly-report";

const week = {
  start: new Date("2026-10-12T00:00:00.000Z"),
  end: new Date("2026-10-19T00:00:00.000Z"),
};
const lastWeek = {
  start: new Date("2026-10-05T00:00:00.000Z"),
  end: new Date("2026-10-12T00:00:00.000Z"),
};
const now = new Date("2026-10-19T06:00:00.000Z");

const snapshot = (
  source: string,
  values: MetricsSnapshot["values"],
  extra: Partial<MetricsSnapshot> = {},
  range = week,
): MetricsSnapshot => ({
  source,
  from: range.start,
  to: range.end,
  values,
  topPages: [],
  topQueries: [],
  ...extra,
});

const ok = (current: MetricsSnapshot, previous: MetricsSnapshot | null = null): SourceResult => ({
  source: current.source,
  outcome: { kind: "ok", current, previous },
});

const build = (results: readonly SourceResult[]) =>
  buildWeeklyReport({
    id: weeklyReportId("rep_1"),
    productId: productId("prod_1"),
    week,
    results,
    now,
  });

const searchConsole = ok(
  snapshot("search_console", {
    search_clicks: 120,
    search_impressions: 4000,
    search_ctr: 0.03,
    search_position: 14.2,
  }),
  snapshot(
    "search_console",
    { search_clicks: 100, search_impressions: 4000, search_ctr: 0.025, search_position: 15 },
    {},
    lastWeek,
  ),
);

describe("buildWeeklyReport", () => {
  it("takes search metrics from Search Console with their week-over-week change", () => {
    const report = build([searchConsole]);
    expect(report).toMatchObject({
      id: "rep_1",
      productId: "prod_1",
      week,
      weekKey: "2026-W42",
      notes: null,
      notesError: null,
      builtAt: now,
    });
    expect(report.metrics).toEqual([
      { name: "search_clicks", value: 120, previous: 100, change: 0.2, source: "search_console" },
      {
        name: "search_impressions",
        value: 4000,
        previous: 4000,
        change: 0,
        source: "search_console",
      },
      { name: "search_ctr", value: 0.03, previous: 0.025, change: 0.2, source: "search_console" },
      {
        name: "search_position",
        value: 14.2,
        previous: 15,
        change: -0.0533,
        source: "search_console",
      },
    ]);
  });

  it("prefers GA4 over Plausible for visitors and pageviews, and records the choice", () => {
    const report = build([
      ok(snapshot("plausible", { visitors: 900, pageviews: 2000 })),
      ok(snapshot("ga4", { visitors: 1000, pageviews: 2500 })),
    ]);
    expect(report.metrics.map((m) => [m.name, m.value, m.source])).toEqual([
      ["visitors", 1000, "ga4"],
      ["pageviews", 2500, "ga4"],
    ]);
  });

  it("falls back to Plausible when GA4 failed", () => {
    const report = build([
      { source: "ga4", outcome: { kind: "failed", reason: "Access was revoked" } },
      ok(snapshot("plausible", { visitors: 900 })),
    ]);
    expect(report.metrics).toEqual([
      { name: "visitors", value: 900, previous: null, change: null, source: "plausible" },
    ]);
  });

  it("uses a source outside the ownership table only when no owner reports the metric", () => {
    expect(build([ok(snapshot("fake", { visitors: 5 }))]).metrics[0]).toMatchObject({
      name: "visitors",
      source: "fake",
    });
  });

  it("has no change when last week is missing or zero", () => {
    const report = build([
      ok(
        snapshot("ga4", { visitors: 50, pageviews: 70 }),
        snapshot("ga4", { visitors: 0 }, {}, lastWeek),
      ),
    ]);
    expect(report.metrics.map((m) => [m.name, m.previous, m.change])).toEqual([
      ["visitors", 0, null],
      ["pageviews", null, null],
    ]);
  });

  it("lists the top 10 pages of the visitors source and the top 10 queries by clicks", () => {
    const pages = Array.from({ length: 12 }, (_, i) => ({ url: `/p${String(i)}`, visitors: i }));
    const queries = [
      { query: "b analytics", clicks: 5, impressions: 50, position: 3.2 },
      { query: "a analytics", clicks: 5, impressions: 70, position: 2.1 },
      { query: "cookieless", clicks: 9, impressions: 90, position: 1.4 },
    ];
    const report = build([
      ok(snapshot("ga4", { visitors: 66 }, { topPages: pages })),
      ok(snapshot("plausible", { visitors: 60 }, { topPages: [{ url: "/x", visitors: 99 }] })),
      ok(snapshot("search_console", { search_clicks: 19 }, { topQueries: queries })),
    ]);
    expect(report.topPages).toHaveLength(10);
    expect(report.topPages[0]).toEqual({ url: "/p11", visitors: 11 });
    expect(report.topQueries.map((q) => q.query)).toEqual([
      "cookieless",
      "a analytics",
      "b analytics",
    ]);
  });

  it("records each source's status, in the order given", () => {
    const report = build([
      searchConsole,
      { source: "ga4", outcome: { kind: "not_connected" } },
      { source: "plausible", outcome: { kind: "failed", reason: "API key rejected" } },
    ]);
    expect(report.sources).toEqual([
      { source: "search_console", status: "ok", reason: null },
      { source: "ga4", status: "not_connected", reason: null },
      { source: "plausible", status: "failed", reason: "API key rejected" },
    ]);
  });
});

describe("analyst notes", () => {
  const notes = { summary: "Clicks rose 20%.", highlights: ["Clicks 120"], suggestions: ["Post"] };

  it("adds the analyst's notes to a report", () => {
    expect(withAnalystNotes(build([searchConsole]), notes)).toMatchObject({
      notes,
      notesError: null,
    });
  });

  it("keeps only the notes' own fields", () => {
    const analysis = { ...notes, citedFacts: ["Free 14-day trial"] };
    const report = withAnalystNotes(build([searchConsole]), analysis);
    expect(report.notes).toEqual(notes);
  });

  it("keeps the report when the analyst could not write notes, saying why", () => {
    const report = withoutAnalystNotes(withAnalystNotes(build([searchConsole]), notes), "Busy");
    expect(report).toMatchObject({ notes: null, notesError: "Busy" });
  });
});
