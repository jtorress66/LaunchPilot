import { err, ok } from "@nuvantre/domain";
import { describe, expect, it } from "vitest";
import { createWebhookHandler } from "./webhook-handler";
import type { RateDecision } from "./rate-limit";

const request = (headers: Record<string, string> = {}) =>
  new Request("https://app.nuvantre.test/api/billing/webhook", {
    method: "POST",
    body: '{"type":"x"}',
    headers: { "x-signature": "sig", ...headers },
  });

const setUp = (decision: RateDecision = { allowed: true }) => {
  const calls: { payload: string; signature: string }[] = [];
  const keys: string[][] = [];
  const handler = createWebhookHandler({
    signatureHeader: "x-signature",
    trustProxy: true,
    rateGuard: (policy, ...parts) => {
      keys.push([policy, ...parts]);
      return Promise.resolve(decision);
    },
    handle: (input) => {
      calls.push(input);
      return Promise.resolve(ok({ handled: true }));
    },
  });
  return { handler, calls, keys };
};

describe("billing webhook handler", () => {
  it("passes the raw body and signature to the use case, limited per sender address", async () => {
    const { handler, calls, keys } = setUp();
    const response = await handler(request({ "x-forwarded-for": "203.0.113.7" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, handled: true });
    expect(calls).toEqual([{ payload: '{"type":"x"}', signature: "sig" }]);
    expect(keys).toEqual([["webhook", "203.0.113.7"]]);
  });

  it("answers 429 with Retry-After when the sender is over its limit, without handling", async () => {
    const { handler, calls } = setUp({
      allowed: false,
      retryAfterSeconds: 42,
      message: "Too many attempts. Try again in 1 minute.",
    });
    const response = await handler(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(calls).toEqual([]);
  });

  it("answers 400 with only the error code when the use case refuses", async () => {
    const handler = createWebhookHandler({
      signatureHeader: "x-signature",
      trustProxy: false,
      rateGuard: () => Promise.resolve({ allowed: true }),
      handle: () =>
        Promise.resolve(
          err({ code: "invalid_signature", message: "Webhook signature is invalid" }),
        ),
    });
    const response = await handler(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_signature" });
  });
});
