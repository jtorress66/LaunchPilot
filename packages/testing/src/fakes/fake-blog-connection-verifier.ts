import { err, ok, type Result } from "@launchpilot/domain";
import type {
  BlogConnectionVerifier,
  BlogCredentials,
  ConnectionError,
  VerifiedBlog,
} from "@launchpilot/ports";

const key = ({ siteUrl, username, secret }: BlogCredentials) =>
  `${siteUrl.replace(/\/$/, "")}\n${username}\n${secret}`;

/** Accepts only the credentials a test registered; records every attempt. */
export class FakeBlogConnectionVerifier implements BlogConnectionVerifier {
  readonly attempts: BlogCredentials[] = [];
  private readonly accepted = new Map<string, string>();

  accept(credentials: BlogCredentials, siteName: string): this {
    this.accepted.set(key(credentials), siteName);
    return this;
  }

  verify(credentials: BlogCredentials): Promise<Result<VerifiedBlog, ConnectionError>> {
    this.attempts.push(credentials);
    const siteName = this.accepted.get(key(credentials));
    return Promise.resolve(
      siteName === undefined
        ? err({
            code: "invalid_credentials",
            message: "The username or application password was not accepted",
            retryable: false,
          })
        : ok({ siteName, siteUrl: credentials.siteUrl }),
    );
  }
}
