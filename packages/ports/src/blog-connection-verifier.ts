import type { BlogPlatform, Result } from "@nuvantre/domain";
import type { PortError } from "./port-error";

export interface BlogCredentials {
  readonly platform: BlogPlatform;
  readonly siteUrl: string;
  /** The platform's non-secret fields, e.g. a WordPress username or a Webflow collection ID. */
  readonly settings: Readonly<Record<string, string>>;
  /** Plaintext only in memory, on its way to the TokenCipher. Never logged. */
  readonly secret: string;
}

/** `wrong_platform`: the address does not answer as that platform (e.g. not a Ghost site). */
export type ConnectionError = PortError<
  "invalid_credentials" | "wrong_platform" | "unreachable" | "blocked"
>;

export interface VerifiedBlog {
  readonly siteName: string;
  /** The blog's own address, which may differ from what was typed (https, www, path). */
  readonly siteUrl: string;
  /** Values the verifier looked up, kept for publishing: a Shopify blog, Webflow field slugs, … */
  readonly settings: Readonly<Record<string, string>>;
}

/** Checks that blog credentials work before they are stored. Verifying only. */
export interface BlogConnectionVerifier {
  verify(credentials: BlogCredentials): Promise<Result<VerifiedBlog, ConnectionError>>;
}
