import { err } from "@nuvantre/domain";
import type { ConnectionError, PublishError } from "@nuvantre/ports";
import type { HttpFailure, SafeHttpOptions } from "../net/safe-http";

export const BLOG_USER_AGENT = "Nuvantre/1.0 (+https://nuvantre.app)";

export interface BlogNetwork {
  /** Development and test only: lets Nuvantre reach a blog on localhost or a LAN. */
  readonly allowPrivateNetwork: boolean;
  readonly timeoutMs?: number;
}

export const blogHttpOptions = ({
  allowPrivateNetwork,
  timeoutMs,
}: BlogNetwork): SafeHttpOptions => ({
  policy: { allowPrivateNetwork },
  userAgent: BLOG_USER_AGENT,
  timeoutMs: timeoutMs ?? 15_000,
  maxBytes: 1_000_000,
});

export const parseJson = (body: string): unknown => {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
};

export const publishError = (code: PublishError["code"], message: string, retryable: boolean) =>
  err<PublishError>({ code, message, retryable });

export const connectionError = (
  code: ConnectionError["code"],
  message: string,
  retryable = false,
) => err<ConnectionError>({ code, message, retryable });

/** A request that never got an answer while publishing. */
export const sendFailure = (error: HttpFailure) =>
  error.reason === "blocked"
    ? publishError("not_connected", "The blog's address cannot be used. Reconnect the blog.", false)
    : publishError("unavailable", "The blog could not be reached. Try again.", true);

/** A request that never got an answer while connecting. */
export const connectFailure = (error: HttpFailure) =>
  error.reason === "blocked"
    ? connectionError("blocked", "That address cannot be used for a blog")
    : connectionError("unreachable", "The blog could not be reached", true);

/**
 * A publish the platform answered with a failure. `reason` is the platform's own explanation,
 * which never contains the key.
 */
export const publishFailureFor = (platform: string, status: number, reason: string | undefined) => {
  if (status === 401 || status === 403) {
    return publishError(
      "not_connected",
      `${platform} no longer accepts the saved key. Reconnect the blog.`,
      false,
    );
  }
  if (status >= 300 && status < 400) {
    return publishError(
      "rejected_by_platform",
      "The blog moved to a new address. Reconnect it with its current address.",
      false,
    );
  }
  if (status === 429 || status >= 500) {
    return publishError(
      "unavailable",
      `${platform} is unavailable (HTTP ${status}). Try again.`,
      true,
    );
  }
  return publishError(
    "rejected_by_platform",
    `${platform} rejected the post: ${reason ?? `HTTP ${status}`}`,
    false,
  );
};
