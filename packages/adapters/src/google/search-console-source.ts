import { err, ok, type MetricsSnapshot, type QueryRow, type Result } from "@nuvantre/domain";
import type {
  AnalyticsConnectionRepository,
  MetricsError,
  MetricsQuery,
  MetricsSource,
  TokenCipher,
} from "@nuvantre/ports";
import { z } from "zod";
import {
  apiFailure,
  callGoogle,
  dateRangeOf,
  unreachable,
  urlsOf,
  type GoogleOptions,
} from "./api";
import { googleAccess, type GoogleAccessDeps } from "./google-source";

const row = z.object({
  keys: z.array(z.string()).optional(),
  clicks: z.number().nonnegative(),
  impressions: z.number().nonnegative(),
  ctr: z.number().nonnegative(),
  position: z.number().nonnegative(),
});
const analytics = z.object({ rows: z.array(row).default([]) });

const TOP = 10;

/** Search Console's Search Analytics API: clicks, impressions, CTR, position and top queries. */
export class SearchConsoleSource implements MetricsSource {
  readonly source = "search_console";

  private readonly deps: GoogleAccessDeps;

  constructor(
    connections: AnalyticsConnectionRepository,
    cipher: TokenCipher,
    private readonly options: GoogleOptions,
  ) {
    this.deps = { connections, cipher, options };
  }

  async fetch(query: MetricsQuery): Promise<Result<MetricsSnapshot, MetricsError>> {
    const access = await googleAccess(
      this.deps,
      query,
      (c) => c.searchConsoleSite !== null,
      "Search Console",
    );
    if (!access.ok) return access;
    const site = access.value.connection.searchConsoleSite ?? "";
    const base = { ...dateRangeOf(query.from, query.to), type: "web" };
    const totals = await this.query(site, access.value.accessToken, base);
    if (!totals.ok) return totals;
    const queries = await this.query(site, access.value.accessToken, {
      ...base,
      dimensions: ["query"],
      rowLimit: TOP,
    });
    if (!queries.ok) return queries;
    const [total] = totals.value;
    return ok({
      source: this.source,
      from: query.from,
      to: query.to,
      values:
        total === undefined
          ? { search_clicks: 0, search_impressions: 0 }
          : {
              search_clicks: total.clicks,
              search_impressions: total.impressions,
              search_ctr: total.ctr,
              search_position: total.position,
            },
      topPages: [],
      topQueries: queries.value.flatMap((r): QueryRow[] => {
        const text = r.keys?.[0]?.trim() ?? "";
        return text === ""
          ? []
          : [{ query: text, clicks: r.clicks, impressions: r.impressions, position: r.position }];
      }),
    });
  }

  private async query(site: string, accessToken: string, body: Record<string, unknown>) {
    const response = await callGoogle(this.options, {
      method: "POST",
      url: `${urlsOf(this.options).searchConsole}/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
      accessToken,
      json: body,
    });
    if (!response.ok) return err<MetricsError>(unreachable("Search Console"));
    const parsed = analytics.safeParse(response.value.body);
    if (response.value.status !== 200 || !parsed.success) {
      return err<MetricsError>(apiFailure(response.value.status, response.value.body, "property"));
    }
    return ok(parsed.data.rows);
  }
}
