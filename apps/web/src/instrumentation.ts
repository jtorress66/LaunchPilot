import type { Instrumentation } from "next";

/** Errors Next catches while rendering or in route handlers go to the error reporter. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // The container needs Node (Postgres, crypto); the edge middleware has nothing to report here.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ getAppContainer }, { reportRequestError }] = await Promise.all([
    import("./container"),
    import("./server/request-error"),
  ]);
  reportRequestError(getAppContainer().errors, error, request, context);
};
