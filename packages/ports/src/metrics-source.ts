import type { ProductId, Result } from "@launchpilot/domain";
import type { PortError } from "./port-error";

export type MetricName =
  "visitors" | "pageviews" | "search_clicks" | "search_impressions" | "signups";

export interface MetricsQuery {
  readonly productId: ProductId;
  readonly from: Date;
  readonly to: Date;
}

export interface MetricsSnapshot {
  readonly source: string;
  readonly from: Date;
  readonly to: Date;
  readonly values: Readonly<Partial<Record<MetricName, number>>>;
  readonly topPages: readonly { readonly url: string; readonly visitors: number }[];
}

export type MetricsError = PortError<"not_connected" | "unavailable">;

/** One analytics source (Search Console, GA4, Plausible…). */
export interface MetricsSource {
  fetch(query: MetricsQuery): Promise<Result<MetricsSnapshot, MetricsError>>;
}
