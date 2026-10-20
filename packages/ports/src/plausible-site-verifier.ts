import type { Result } from "@launchpilot/domain";
import type { PortError } from "./port-error";

export interface PlausibleCredentials {
  readonly baseUrl: string;
  readonly siteId: string;
  /** Plaintext only in memory, on its way to the TokenCipher. Never logged. */
  readonly apiKey: string;
}

export type PlausibleVerifyError = PortError<
  "invalid_credentials" | "site_not_found" | "unreachable" | "blocked"
>;

/** Checks a Plausible site and Stats API key with one query before they are stored. */
export interface PlausibleSiteVerifier {
  verify(credentials: PlausibleCredentials): Promise<Result<void, PlausibleVerifyError>>;
}
