import { describe, expect, it } from "vitest";
import { SentryErrorReporter, scrubSentryEvent, type SentryCapture } from "./sentry-error-reporter";

describe("SentryErrorReporter", () => {
  it("sends the error with where it happened as tags", () => {
    const sent: Parameters<SentryCapture>[] = [];
    const reporter = new SentryErrorReporter((...args) => sent.push(args));
    const error = new Error("boom");
    reporter.report(error, { requestId: "req_1", job: "publish-due", workspaceId: "ws_1" });
    expect(sent).toEqual([
      [error, { tags: { requestId: "req_1", job: "publish-due", workspaceId: "ws_1" } }],
    ]);
  });

  it("never throws when Sentry does", () => {
    const reporter = new SentryErrorReporter(() => {
      throw new Error("offline");
    });
    expect(() => {
      reporter.report(new Error("boom"), {});
    }).not.toThrow();
  });

  it("scrubs secrets from an event's messages, exception values and breadcrumbs before sending", () => {
    expect(
      scrubSentryEvent({
        message: "Bearer abc",
        exception: { values: [{ type: "Error", value: "sk_live_123 leaked" }] },
        breadcrumbs: [{ message: "GET https://x.io/cb?code=abc" }],
        request: { headers: { authorization: "Bearer abc", cookie: "lp_session=xyz" } },
      }),
    ).toEqual({
      message: "Bearer [redacted]",
      exception: { values: [{ type: "Error", value: "[redacted] leaked" }] },
      breadcrumbs: [{ message: "GET https://x.io/cb?code=[redacted]" }],
      request: { headers: {} },
    });
  });
});
