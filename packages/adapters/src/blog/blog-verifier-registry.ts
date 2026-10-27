import { blogPlatforms, err, type BlogPlatform, type Result } from "@nuvantre/domain";
import type {
  BlogConnectionVerifier,
  BlogCredentials,
  ConnectionError,
  VerifiedBlog,
} from "@nuvantre/ports";

/** Verifies credentials with the verifier registered for their platform. */
export class BlogVerifierRegistry implements BlogConnectionVerifier {
  constructor(private readonly verifiers: Partial<Record<BlogPlatform, BlogConnectionVerifier>>) {}

  verify(credentials: BlogCredentials): Promise<Result<VerifiedBlog, ConnectionError>> {
    const verifier = this.verifiers[credentials.platform];
    if (!verifier) {
      const name = blogPlatforms[credentials.platform].name;
      return Promise.resolve(
        err({
          code: "wrong_platform",
          message: `Connecting a ${name} blog is not available yet`,
          retryable: false,
        }),
      );
    }
    return verifier.verify(credentials);
  }
}
