import * as Sentry from "@sentry/node";
import type { ErrorReporter } from "@nuvantre/ports";
import { scrubSecrets } from "./scrub-secrets";
import { scrubSentryEvent, SentryErrorReporter } from "./sentry-error-reporter";

/** Starts the Sentry SDK for one app, scrubbing every event, and returns its reporter. */
export const createSentryErrorReporter = (options: {
  readonly dsn: string;
  readonly environment: string;
  readonly release: string;
}): ErrorReporter => {
  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    release: options.release,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubSentryEvent(event),
    beforeBreadcrumb: (crumb) =>
      crumb.message === undefined ? crumb : { ...crumb, message: scrubSecrets(crumb.message) },
  });
  return new SentryErrorReporter((error, hint) => {
    Sentry.captureException(error, hint);
  });
};
