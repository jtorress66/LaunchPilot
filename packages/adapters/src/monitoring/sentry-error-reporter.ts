import type { ErrorContext, ErrorReporter } from "@nuvantre/ports";
import { scrubSecrets } from "./scrub-secrets";

/** Sentry's `captureException`, narrowed to what this adapter uses. */
export type SentryCapture = (
  error: unknown,
  hint: { readonly tags: Readonly<Record<string, string>> },
) => void;

/** Reports to Sentry when SENTRY_DSN is set; events are scrubbed in `beforeSend` as well. */
export class SentryErrorReporter implements ErrorReporter {
  constructor(private readonly capture: SentryCapture) {}

  report(error: unknown, context: ErrorContext): void {
    try {
      const tags = Object.fromEntries(
        Object.entries(context).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      );
      this.capture(error, { tags });
    } catch {
      // Never fail the request or job because Sentry is unreachable.
    }
  }
}

interface SentryEventLike {
  message?: string;
  exception?: { values?: { type?: string; value?: string }[] };
  breadcrumbs?: { message?: string }[];
  request?: { headers?: Record<string, string> };
}

const SECRET_HEADERS = new Set([
  "authorization",
  "cookie",
  "x-shopify-access-token",
  "wix-site-id",
]);

/** `beforeSend`: no secret leaves in a message, an exception, a breadcrumb or a header. */
export const scrubSentryEvent = <E extends SentryEventLike>(event: E): E => ({
  ...event,
  ...(event.message === undefined ? {} : { message: scrubSecrets(event.message) }),
  ...(event.exception?.values
    ? {
        exception: {
          ...event.exception,
          values: event.exception.values.map((value) => ({
            ...value,
            ...(value.value === undefined ? {} : { value: scrubSecrets(value.value) }),
          })),
        },
      }
    : {}),
  ...(event.breadcrumbs
    ? {
        breadcrumbs: event.breadcrumbs.map((crumb) => ({
          ...crumb,
          ...(crumb.message === undefined ? {} : { message: scrubSecrets(crumb.message) }),
        })),
      }
    : {}),
  ...(event.request?.headers
    ? {
        request: {
          ...event.request,
          headers: Object.fromEntries(
            Object.entries(event.request.headers).filter(
              ([name]) => !SECRET_HEADERS.has(name.toLowerCase()),
            ),
          ),
        },
      }
    : {}),
});
