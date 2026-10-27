import type { Instrumentation } from "next";

/** Errors Next catches while rendering or in route handlers go to the error reporter. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // Inside this check, so the edge build drops the Node-only container (Postgres, crypto).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ getAppContainer }, { reportRequestError }] = await Promise.all([
      import("./container"),
      import("./server/request-error"),
    ]);
    reportRequestError(getAppContainer().errors, error, request, context);
  }
};
