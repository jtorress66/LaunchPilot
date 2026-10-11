import { parseEmail, workspaceId } from "@launchpilot/domain";
import { describeCheckoutProviderContract } from "@launchpilot/testing/contracts";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import Stripe from "stripe";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { StripeCheckoutProvider } from "../../src";
import apiError from "./recorded/api-error.json";
import checkoutSession from "./recorded/checkout-session.json";
import pricesList from "./recorded/prices-list.json";

const api = "https://api.stripe.com/v1";
const server = setupServer(
  http.get(`${api}/prices`, () => HttpResponse.json(pricesList)),
  http.post(`${api}/checkout/sessions`, () => HttpResponse.json(checkoutSession)),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const provider = () =>
  new StripeCheckoutProvider(
    new Stripe("sk_test_recorded", {
      httpClient: Stripe.createFetchHttpClient(),
      maxNetworkRetries: 0,
    }),
  );

const outage = () => {
  server.use(
    http.post(`${api}/checkout/sessions`, () => HttpResponse.json(apiError, { status: 500 })),
  );
};

describeCheckoutProviderContract("StripeCheckoutProvider", () => ({
  provider: provider(),
  givenFailure: outage,
}));

const email = parseEmail("founder@acme.dev");
if (!email.ok) throw new Error("bad email");
const request = {
  workspaceId: workspaceId("ws_1"),
  plan: "starter" as const,
  email: email.value,
  successUrl: "https://app.launchpilot.test/app/billing?checkout=success",
  cancelUrl: "https://app.launchpilot.test/app/billing?checkout=canceled",
};

describe("StripeCheckoutProvider", () => {
  it("creates a subscription checkout for the plan's price with workspace metadata", async () => {
    let priceQuery = "";
    let sessionBody = new URLSearchParams();
    server.use(
      http.get(`${api}/prices`, ({ request: req }) => {
        priceQuery = new URL(req.url).search;
        return HttpResponse.json(pricesList);
      }),
      http.post(`${api}/checkout/sessions`, async ({ request: req }) => {
        sessionBody = new URLSearchParams(await req.text());
        return HttpResponse.json(checkoutSession);
      }),
    );

    const result = await provider().createCheckout(request);

    expect(result).toEqual({ ok: true, value: { url: checkoutSession.url } });
    expect(decodeURIComponent(priceQuery)).toContain("lookup_keys[0]=launchpilot_starter_monthly");
    expect(Object.fromEntries(sessionBody)).toMatchObject({
      mode: "subscription",
      "line_items[0][price]": "price_1QStarterMonthly",
      "line_items[0][quantity]": "1",
      customer_email: "founder@acme.dev",
      client_reference_id: "ws_1",
      "metadata[workspace_id]": "ws_1",
      "metadata[plan]": "starter",
      "subscription_data[metadata][workspace_id]": "ws_1",
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
    });
  });

  it("explains how to fix a missing price instead of failing obscurely", async () => {
    server.use(http.get(`${api}/prices`, () => HttpResponse.json({ ...pricesList, data: [] })));
    const result = await provider().createCheckout(request);
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "misconfigured",
        message: expect.stringContaining("pnpm stripe:setup") as unknown,
      },
    });
  });

  it("reports a session without a URL as a provider error", async () => {
    server.use(
      http.post(`${api}/checkout/sessions`, () =>
        HttpResponse.json({ ...checkoutSession, url: null }),
      ),
    );
    const result = await provider().createCheckout(request);
    expect(result.ok ? undefined : result.error.code).toBe("provider_error");
  });

  it("never offers a checkout for the Free plan", async () => {
    const result = await provider().createCheckout({ ...request, plan: "free" });
    expect(result.ok ? undefined : result.error.code).toBe("misconfigured");
  });
});
