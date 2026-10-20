import {
  analyticsConnectionId,
  analyticsProviders,
  productId,
  weeklyReportId,
  type AnalyticsConnection,
  type WeeklyReport,
} from "@launchpilot/domain";
import type { AnalyticsConnectionRow, WeeklyReportRow } from "../schema";
import { oneOf, readJson, toJson } from "./columns";

const required = (value: string | null, column: string): string => {
  if (value === null) throw new Error(`Missing value in ${column}`);
  return value;
};

export const analyticsConnectionMapper = {
  toRow: (c: AnalyticsConnection): AnalyticsConnectionRow => ({
    id: c.id,
    product_id: c.productId,
    provider: c.provider,
    encrypted_secret: c.encryptedSecret,
    account_email: c.provider === "google" ? c.accountEmail : null,
    search_console_site: c.provider === "google" ? c.searchConsoleSite : null,
    ga4_property_id: c.provider === "google" ? c.ga4PropertyId : null,
    site_id: c.provider === "plausible" ? c.siteId : null,
    base_url: c.provider === "plausible" ? c.baseUrl : null,
    connected_at: c.connectedAt,
  }),
  fromRow: (row: AnalyticsConnectionRow): AnalyticsConnection => {
    const base = {
      id: analyticsConnectionId(row.id),
      productId: productId(row.product_id),
      encryptedSecret: row.encrypted_secret,
      connectedAt: row.connected_at,
    };
    const provider = oneOf(analyticsProviders, row.provider, "analytics_connections.provider");
    return provider === "google"
      ? {
          ...base,
          provider,
          accountEmail: required(row.account_email, "analytics_connections.account_email"),
          searchConsoleSite: row.search_console_site,
          ga4PropertyId: row.ga4_property_id,
        }
      : {
          ...base,
          provider,
          siteId: required(row.site_id, "analytics_connections.site_id"),
          baseUrl: required(row.base_url, "analytics_connections.base_url"),
        };
  },
};

type StoredReport = Pick<WeeklyReport, "metrics" | "topPages" | "topQueries" | "sources" | "notes">;

export const weeklyReportMapper = {
  toRow: (r: WeeklyReport): WeeklyReportRow => ({
    id: r.id,
    product_id: r.productId,
    week_key: r.weekKey,
    week_start: r.week.start,
    week_end: r.week.end,
    report: toJson({
      metrics: r.metrics,
      topPages: r.topPages,
      topQueries: r.topQueries,
      sources: r.sources,
      notes: r.notes,
    } satisfies StoredReport),
    notes_error: r.notesError,
    built_at: r.builtAt,
  }),
  fromRow: (row: WeeklyReportRow): WeeklyReport => {
    const stored = readJson(row.report) as StoredReport;
    return {
      id: weeklyReportId(row.id),
      productId: productId(row.product_id),
      week: { start: row.week_start, end: row.week_end },
      weekKey: row.week_key,
      metrics: stored.metrics,
      topPages: stored.topPages,
      topQueries: stored.topQueries,
      sources: stored.sources,
      notes: stored.notes,
      notesError: row.notes_error,
      builtAt: row.built_at,
    };
  },
};
