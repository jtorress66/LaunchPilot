import { err, ok, type MetricsSnapshot, type Result } from "@nuvantre/domain";
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

const count = z.coerce.number().nonnegative();
const report = z.object({
  rows: z
    .array(
      z.object({
        dimensionValues: z.array(z.object({ value: z.string() })).optional(),
        metricValues: z.array(z.object({ value: count })),
      }),
    )
    .default([]),
});

const TOP = 10;

/** The GA4 Data API: active users, pageviews and the top pages by active users. */
export class Ga4Source implements MetricsSource {
  readonly source = "ga4";

  private readonly deps: GoogleAccessDeps;

  constructor(
    connections: AnalyticsConnectionRepository,
    cipher: TokenCipher,
    private readonly options: GoogleOptions,
  ) {
    this.deps = { connections, cipher, options };
  }

  async fetch(query: MetricsQuery): Promise<Result<MetricsSnapshot, MetricsError>> {
    const access = await googleAccess(this.deps, query, (c) => c.ga4PropertyId !== null, "GA4");
    if (!access.ok) return access;
    const property = access.value.connection.ga4PropertyId ?? "";
    const dateRanges = [dateRangeOf(query.from, query.to)];
    const totals = await this.run(property, access.value.accessToken, {
      dateRanges,
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
    });
    if (!totals.ok) return totals;
    const pages = await this.run(property, access.value.accessToken, {
      dateRanges,
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: TOP,
    });
    if (!pages.ok) return pages;
    const [visitors = 0, pageviews = 0] = totals.value[0]?.metricValues.map((m) => m.value) ?? [];
    return ok({
      source: this.source,
      from: query.from,
      to: query.to,
      values: { visitors, pageviews },
      topPages: pages.value.flatMap((r) => {
        const url = r.dimensionValues?.[0]?.value ?? "";
        return url === "" ? [] : [{ url, visitors: r.metricValues[0]?.value ?? 0 }];
      }),
      topQueries: [],
    });
  }

  private async run(property: string, accessToken: string, body: Record<string, unknown>) {
    const response = await callGoogle(this.options, {
      method: "POST",
      url: `${urlsOf(this.options).analyticsData}/properties/${encodeURIComponent(property)}:runReport`,
      accessToken,
      json: body,
    });
    if (!response.ok) return err<MetricsError>(unreachable("Analytics"));
    const parsed = report.safeParse(response.value.body);
    if (response.value.status !== 200 || !parsed.success) {
      return err<MetricsError>(apiFailure(response.value.status, response.value.body, "property"));
    }
    return ok(parsed.data.rows);
  }
}
