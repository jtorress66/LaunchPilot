import type { Result } from "@launchpilot/domain";
import type { PortError } from "./port-error";

export interface BlogCredentials {
  readonly siteUrl: string;
  readonly username: string;
  /** Plaintext only in memory, on its way to the TokenCipher. Never logged. */
  readonly secret: string;
}

export type ConnectionError = PortError<
  "invalid_credentials" | "not_wordpress" | "unreachable" | "blocked"
>;

export interface VerifiedBlog {
  readonly siteName: string;
  /** The blog's own address, which may differ from what was typed (https, www, path). */
  readonly siteUrl: string;
}

/** Checks that blog credentials work before they are stored. Verifying only. */
export interface BlogConnectionVerifier {
  verify(credentials: BlogCredentials): Promise<Result<VerifiedBlog, ConnectionError>>;
}
