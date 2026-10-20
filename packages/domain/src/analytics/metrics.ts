/** The figures a weekly report shows, in display order. */
export const metricNames = [
  "visitors",
  "pageviews",
  "search_clicks",
  "search_impressions",
  /** Click-through rate as a fraction: 0.034 is 3.4%. */
  "search_ctr",
  /** Average position in Google results; lower is better. */
  "search_position",
] as const;
export type MetricName = (typeof metricNames)[number];

export interface PageRow {
  /** A path such as `/pricing`, or a full URL when the source reports one. */
  readonly url: string;
  readonly visitors: number;
}

export interface QueryRow {
  readonly query: string;
  readonly clicks: number;
  readonly impressions: number;
  readonly position: number;
}

/** One source's figures for one week. */
export interface MetricsSnapshot {
  readonly source: string;
  readonly from: Date;
  readonly to: Date;
  readonly values: Readonly<Partial<Record<MetricName, number>>>;
  readonly topPages: readonly PageRow[];
  readonly topQueries: readonly QueryRow[];
}

/**
 * Which sources a metric is taken from, most trusted first. A source not listed is used only
 * when none of these reports the metric. Adding a source means adding it here, not new branches.
 */
export const metricOwners: Readonly<Record<MetricName, readonly string[]>> = {
  visitors: ["ga4", "plausible"],
  pageviews: ["ga4", "plausible"],
  search_clicks: ["search_console"],
  search_impressions: ["search_console"],
  search_ctr: ["search_console"],
  search_position: ["search_console"],
};
