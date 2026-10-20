import { err, ok, type MetricsSnapshot, type Result } from "@launchpilot/domain";
import type {
  AnalyticsConnectionRepository,
  MetricsError,
  MetricsQuery,
  MetricsSource,
  TokenCipher,
} from "@launchpilot/ports";
import { dateRangeOf, queryStats, type PlausibleNetwork, type StatsFailure } from "./stats-api";

const TOP = 10;

const metricsError = (failure: StatsFailure): MetricsError => {
  switch (failure.kind) {
    case "invalid_key":
      return {
        code: "invalid_credentials",
        message: "Plausible rejected the API key",
        retryable: false,
      };
    case "site_not_found":
      return {
        code: "no_access",
        message: "Plausible could not find the site for this key",
        retryable: false,
      };
    case "network":
      return {
        code: "unavailable",
        message:
          failure.failure.reason === "blocked"
            ? "The Plausible address is one LaunchPilot cannot reach"
            : "Plausible could not be reached",
        retryable: failure.failure.reason !== "blocked",
      };
    case "http":
      return {
        code: "unavailable",
        message: `Plausible did not answer (HTTP ${String(failure.status)})`,
        retryable: failure.status === 429 || failure.status >= 500,
      };
  }
};

/** Plausible's Stats API v2: visitors, pageviews and top pages for the product's site. */
export class PlausibleSource implements MetricsSource {
  readonly source = "plausible";

  constructor(
    private readonly connections: AnalyticsConnectionRepository,
    private readonly cipher: TokenCipher,
    private readonly network: PlausibleNetwork,
  ) {}

  async fetch(query: MetricsQuery): Promise<Result<MetricsSnapshot, MetricsError>> {
    const connection = await this.connections.find(query.productId, "plausible");
    if (!connection) {
      return err({ code: "not_connected", message: "Connect Plausible first", retryable: false });
    }
    const apiKey = await this.cipher.decrypt(connection.encryptedSecret);
    const base = { site_id: connection.siteId, date_range: dateRangeOf(query.from, query.to) };
    const totals = await queryStats(this.network, connection.baseUrl, apiKey, {
      site_id: base.site_id,
      metrics: ["visitors", "pageviews"],
      date_range: base.date_range,
    });
    if (!totals.ok) return err(metricsError(totals.error));
    const pages = await queryStats(this.network, connection.baseUrl, apiKey, {
      ...base,
      metrics: ["visitors"],
      dimensions: ["event:page"],
      order_by: [["visitors", "desc"]],
      pagination: { limit: TOP },
    });
    if (!pages.ok) return err(metricsError(pages.error));
    const [visitors = 0, pageviews = 0] = totals.value[0]?.metrics ?? [];
    return ok({
      source: this.source,
      from: query.from,
      to: query.to,
      values: { visitors, pageviews },
      topPages: pages.value.flatMap((r) => {
        const url = r.dimensions[0] ?? "";
        return url === "" ? [] : [{ url, visitors: r.metrics[0] ?? 0 }];
      }),
      topQueries: [],
    });
  }
}
