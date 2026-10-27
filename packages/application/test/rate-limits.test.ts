import { describe, expect, it } from "vitest";
import { rateLimitKey, rateLimitMessage, rateLimits } from "../src";

describe("rate-limit policies", () => {
  it("cap sign-ins, sign-ups, AI drafting, connections and webhooks", () => {
    expect(rateLimits).toEqual({
      login: { limit: 10, windowSeconds: 900 },
      signup: { limit: 5, windowSeconds: 3600 },
      draft: { limit: 30, windowSeconds: 3600 },
      connect: { limit: 20, windowSeconds: 3600 },
      webhook: { limit: 120, windowSeconds: 60 },
    });
  });

  it("key a policy by its parts, ignoring case and spaces in an email", () => {
    expect(rateLimitKey("login", "203.0.113.7", " Founder@Acme.dev ")).toBe(
      "login:203.0.113.7:founder@acme.dev",
    );
    expect(rateLimitKey("draft", "ws_1")).toBe("draft:ws_1");
  });

  it.each([
    [1, "Too many attempts. Try again in 1 minute."],
    [60, "Too many attempts. Try again in 1 minute."],
    [61, "Too many attempts. Try again in 2 minutes."],
    [900, "Too many attempts. Try again in 15 minutes."],
  ])("tells the founder how long to wait (%i s)", (seconds, message) => {
    expect(rateLimitMessage(seconds)).toBe(message);
  });
});
