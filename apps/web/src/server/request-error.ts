import type { ErrorReporter } from "@nuvantre/ports";

/** The parts of Next's `onRequestError` request that a report needs. */
export interface FailedRequest {
  readonly path: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

/** Sends an error Next caught while serving a request to the reporter, with where it happened. */
export const reportRequestError = (
  errors: ErrorReporter,
  error: unknown,
  request: FailedRequest,
  context: { readonly routePath?: string },
): void => {
  const requestId = request.headers["x-request-id"];
  errors.report(error, {
    ...(typeof requestId === "string" ? { requestId } : {}),
    // The pattern, or the bare path: query strings can carry secrets.
    route: context.routePath ?? request.path.split("?")[0] ?? "",
  });
};
