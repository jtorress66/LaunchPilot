import type { Result } from "@nuvantre/domain";
import type { PortError } from "./port-error";

export interface SearchConsoleSite {
  /** `sc-domain:acme.dev` or a URL-prefix property. */
  readonly siteUrl: string;
}

export interface Ga4Property {
  /** The numeric property id. */
  readonly id: string;
  readonly name: string;
  readonly account: string;
}

export interface AnalyticsProperties {
  readonly searchConsoleSites: readonly SearchConsoleSite[];
  readonly ga4Properties: readonly Ga4Property[];
}

export type PropertyListError = PortError<"invalid_credentials" | "unavailable">;

/** The Search Console and GA4 properties a Google account can read. Listing only. */
export interface AnalyticsPropertyLister {
  list(refreshToken: string): Promise<Result<AnalyticsProperties, PropertyListError>>;
}
