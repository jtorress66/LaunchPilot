import { err, ok, type Result } from "@launchpilot/domain";
import type {
  PlausibleCredentials,
  PlausibleSiteVerifier,
  PlausibleVerifyError,
} from "@launchpilot/ports";
import { queryStats, type PlausibleNetwork, type StatsFailure } from "./stats-api";

const verifyError = (failure: StatsFailure): PlausibleVerifyError => {
  switch (failure.kind) {
    case "invalid_key":
      return {
        code: "invalid_credentials",
        message: "Plausible rejected the API key",
        retryable: false,
      };
    case "site_not_found":
      return {
        code: "site_not_found",
        message: "Plausible has no site with that domain for this key",
        retryable: false,
      };
    case "network":
      return failure.failure.reason === "blocked"
        ? {
            code: "blocked",
            message: "That address cannot be used for Plausible",
            retryable: false,
          }
        : { code: "unreachable", message: "Plausible could not be reached", retryable: true };
    case "http":
      return {
        code: "unreachable",
        message: `Plausible did not answer (HTTP ${String(failure.status)})`,
        retryable: true,
      };
  }
};

/** Checks a Plausible site and Stats API key with one small query before they are stored. */
export class PlausibleStatsVerifier implements PlausibleSiteVerifier {
  constructor(private readonly network: PlausibleNetwork) {}

  async verify({
    baseUrl,
    siteId,
    apiKey,
  }: PlausibleCredentials): Promise<Result<void, PlausibleVerifyError>> {
    const result = await queryStats(this.network, baseUrl, apiKey, {
      site_id: siteId,
      metrics: ["visitors"],
      date_range: "day",
    });
    return result.ok ? ok(undefined) : err(verifyError(result.error));
  }
}
