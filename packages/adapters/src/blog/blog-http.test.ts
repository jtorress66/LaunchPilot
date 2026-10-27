import { describe, expect, it } from "vitest";
import { connectFailure, publishFailureFor, sendFailure } from "./blog-http";

describe("publishFailureFor", () => {
  it.each([
    [401, "not_connected", false, "Ghost no longer accepts the saved key. Reconnect the blog."],
    [403, "not_connected", false, "Ghost no longer accepts the saved key. Reconnect the blog."],
    [
      301,
      "rejected_by_platform",
      false,
      "The blog moved to a new address. Reconnect it with its current address.",
    ],
    [429, "unavailable", true, "Ghost is unavailable (HTTP 429). Try again."],
    [503, "unavailable", true, "Ghost is unavailable (HTTP 503). Try again."],
    [422, "rejected_by_platform", false, "Ghost rejected the post: Slug already in use"],
  ])("maps HTTP %i to %s", (status, code, retryable, message) => {
    expect(publishFailureFor("Ghost", status, "Slug already in use")).toEqual({
      ok: false,
      error: { code, retryable, message },
    });
  });

  it("names the status when the platform gives no reason", () => {
    expect(publishFailureFor("Webflow", 400, undefined)).toMatchObject({
      error: { message: "Webflow rejected the post: HTTP 400" },
    });
  });
});

describe("network failures", () => {
  it("treats a blocked address as a connection to fix, and anything else as a retry", () => {
    expect(sendFailure({ reason: "blocked", message: "x" })).toMatchObject({
      error: { code: "not_connected", retryable: false },
    });
    expect(sendFailure({ reason: "timeout", message: "x" })).toMatchObject({
      error: { code: "unavailable", retryable: true },
    });
    expect(connectFailure({ reason: "blocked", message: "x" })).toMatchObject({
      error: { code: "blocked", retryable: false },
    });
    expect(connectFailure({ reason: "network", message: "x" })).toMatchObject({
      error: { code: "unreachable", retryable: true },
    });
  });
});
