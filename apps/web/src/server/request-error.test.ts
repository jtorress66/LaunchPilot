import { FakeErrorReporter } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { reportRequestError } from "./request-error";

describe("reportRequestError", () => {
  it("reports a failed request with its request id and route", () => {
    const errors = new FakeErrorReporter();
    const error = new Error("boom");
    reportRequestError(
      errors,
      error,
      { path: "/app/products/p1?tab=x", headers: { "x-request-id": "req_1" } },
      { routePath: "/app/products/[productId]" },
    );
    expect(errors.reports).toEqual([
      { error, context: { requestId: "req_1", route: "/app/products/[productId]" } },
    ]);
  });

  it("falls back to the path without its query when Next has no route pattern", () => {
    const errors = new FakeErrorReporter();
    reportRequestError(errors, new Error("x"), { path: "/api/x?token=secret", headers: {} }, {});
    expect(errors.reports[0]?.context).toEqual({ route: "/api/x" });
  });
});
