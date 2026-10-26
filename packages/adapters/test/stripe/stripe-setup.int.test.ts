import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import Stripe from "stripe";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ensureStripePrices } from "../../src";
import pricesList from "./recorded/prices-list.json";

const api = "https://api.stripe.com/v1";
const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const stripe = () =>
  new Stripe("sk_test_recorded", {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 0,
  });

describe("ensureStripePrices", () => {
  it("creates a monthly USD price for every paid plan that is missing one", async () => {
    const created: Record<string, string>[] = [];
    server.use(
      http.get(`${api}/prices`, () => HttpResponse.json({ ...pricesList, data: [] })),
      http.post(`${api}/prices`, async ({ request }) => {
        const body = Object.fromEntries(new URLSearchParams(await request.text()));
        created.push(body);
        return HttpResponse.json({
          id: `price_${created.length}`,
          object: "price",
          lookup_key: body.lookup_key,
        });
      }),
    );

    expect(await ensureStripePrices(stripe())).toEqual({
      ok: true,
      value: { created: ["nuvantre_starter_monthly", "nuvantre_growth_monthly"] },
    });
    expect(created).toEqual([
      expect.objectContaining({
        lookup_key: "nuvantre_starter_monthly",
        currency: "usd",
        unit_amount: "2900",
        "recurring[interval]": "month",
        "product_data[name]": "Nuvantre Starter",
      }),
      expect.objectContaining({ lookup_key: "nuvantre_growth_monthly", unit_amount: "7900" }),
    ]);
  });

  it("leaves existing prices alone, so it is safe to run again", async () => {
    server.use(http.get(`${api}/prices`, () => HttpResponse.json(pricesList)));
    expect(await ensureStripePrices(stripe())).toEqual({ ok: true, value: { created: [] } });
  });

  it("reports a Stripe failure as an error result", async () => {
    server.use(
      http.get(`${api}/prices`, () =>
        HttpResponse.json(
          { error: { type: "authentication_error", message: "Invalid API Key" } },
          { status: 401 },
        ),
      ),
    );
    const result = await ensureStripePrices(stripe());
    expect(result).toEqual({ ok: false, error: "Invalid API Key" });
  });
});
