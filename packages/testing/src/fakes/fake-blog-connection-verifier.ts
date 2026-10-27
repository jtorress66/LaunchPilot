import { err, ok, type Result } from "@nuvantre/domain";
import type {
  BlogConnectionVerifier,
  BlogCredentials,
  ConnectionError,
  VerifiedBlog,
} from "@nuvantre/ports";

const key = ({ platform, siteUrl, settings, secret }: BlogCredentials) =>
  JSON.stringify([platform, siteUrl.replace(/\/$/, ""), settings, secret]);

/** Accepts only the credentials a test registered; records every attempt. */
export class FakeBlogConnectionVerifier implements BlogConnectionVerifier {
  readonly attempts: BlogCredentials[] = [];
  private readonly accepted = new Map<
    string,
    { siteName: string; settings: Readonly<Record<string, string>> }
  >();

  /** `resolved` are extra settings the platform would look up, such as a Shopify blog. */
  accept(
    credentials: BlogCredentials,
    siteName: string,
    resolved: Readonly<Record<string, string>> = {},
  ): this {
    this.accepted.set(key(credentials), { siteName, settings: resolved });
    return this;
  }

  verify(credentials: BlogCredentials): Promise<Result<VerifiedBlog, ConnectionError>> {
    this.attempts.push(credentials);
    const found = this.accepted.get(key(credentials));
    return Promise.resolve(
      found === undefined
        ? err({
            code: "invalid_credentials",
            message: "The blog did not accept those details",
            retryable: false,
          })
        : ok({
            siteName: found.siteName,
            siteUrl: credentials.siteUrl,
            settings: { ...credentials.settings, ...found.settings },
          }),
    );
  }
}
