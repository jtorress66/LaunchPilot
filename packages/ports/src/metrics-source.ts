import type { MetricsSnapshot, ProductId, Result } from "@launchpilot/domain";
import type { PortError } from "./port-error";

export interface MetricsQuery {
  readonly productId: ProductId;
  readonly from: Date;
  /** Exclusive: a week is Monday 00:00 up to the next Monday 00:00 UTC. */
  readonly to: Date;
}

export type MetricsError = PortError<
  "not_connected" | "invalid_credentials" | "no_access" | "unavailable"
>;

/**
 * One analytics source (Search Console, GA4, Plausible…). Each reads its own product
 * connection and answers `not_connected` when the product has none. Reading only.
 */
export interface MetricsSource {
  /** The name a report records for this source, e.g. `search_console`. */
  readonly source: string;
  fetch(query: MetricsQuery): Promise<Result<MetricsSnapshot, MetricsError>>;
}
