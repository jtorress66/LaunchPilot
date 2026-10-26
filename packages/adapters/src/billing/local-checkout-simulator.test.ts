import { workspaceId } from "@nuvantre/domain";
import { describe, expect, it } from "vitest";
import { LocalWebhookVerifier } from "./local-billing";
import { LocalCheckoutSimulator } from "./local-checkout-simulator";

const secret = "local-simulator-secret-0123";

describe("LocalCheckoutSimulator", () => {
  it("posts a signed activation webhook to the app, as a real provider would after payment", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response("{}", { status: 200 }));
    };
    const now = new Date("2026-05-01T09:00:00.000Z");
    const simulator = new LocalCheckoutSimulator(
      "http://localhost:3000",
      secret,
      fakeFetch,
      () => now,
    );

    const result = await simulator.pay({ workspaceId: workspaceId("ws_1"), plan: "starter" });

    expect(result).toEqual({ ok: true, value: null });
    const [call] = calls;
    expect(call?.url).toBe("http://localhost:3000/api/billing/webhook");
    const headers = new Headers(call?.init.headers);
    const verified = await new LocalWebhookVerifier(secret).verify(
      typeof call?.init.body === "string" ? call.init.body : "",
      headers.get(LocalCheckoutSimulator.signatureHeader) ?? "",
    );
    expect(verified).toMatchObject({
      ok: true,
      value: {
        type: "subscription_activated",
        workspaceId: "ws_1",
        plan: "starter",
        occurredAt: now,
      },
    });
  });

  it("reports a webhook the app refused", async () => {
    const refusing = () => Promise.resolve(new Response("{}", { status: 400 }));
    const simulator = new LocalCheckoutSimulator("http://localhost:3000", secret, refusing);
    const result = await simulator.pay({ workspaceId: workspaceId("ws_1"), plan: "growth" });
    expect(result).toEqual({
      ok: false,
      error: "The app rejected the local billing webhook (HTTP 400)",
    });
  });
});
