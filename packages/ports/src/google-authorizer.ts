import type { Result } from "@launchpilot/domain";
import type { PortError } from "./port-error";

export interface GoogleGrant {
  /** Plaintext only in memory, on its way to the TokenCipher. Never logged. */
  readonly refreshToken: string;
  readonly accountEmail: string;
}

export type GoogleAuthError = PortError<
  "denied" | "invalid_grant" | "missing_scope" | "unavailable"
>;

/** Google's OAuth consent flow for read-only Search Console and GA4 access. Authorising only. */
export interface GoogleAuthorizer {
  /** Google's consent page; it returns to `redirectUrl` with `state` and a code. */
  authorizationUrl(input: { readonly state: string; readonly redirectUrl: string }): string;
  exchangeCode(input: {
    readonly code: string;
    readonly redirectUrl: string;
  }): Promise<Result<GoogleGrant, GoogleAuthError>>;
}
