import { err, ok, type Result } from "@nuvantre/domain";
import type { BillingError, CheckoutProvider, CheckoutRequest } from "@nuvantre/ports";
import type Stripe from "stripe";
import { stripeLookupKeys } from "./stripe-plans";

const providerError = (message: string): Result<never, BillingError> =>
  err({ code: "provider_error", message, retryable: true });

/** Creates a subscription-mode Stripe Checkout Session for a paid plan. */
export class StripeCheckoutProvider implements CheckoutProvider {
  constructor(private readonly stripe: Stripe) {}

  async createCheckout(request: CheckoutRequest): Promise<Result<{ url: string }, BillingError>> {
    if (request.plan === "free") {
      return err({
        code: "misconfigured",
        message: "The Free plan has no checkout",
        retryable: false,
      });
    }
    const lookupKey = stripeLookupKeys[request.plan];
    try {
      const prices = await this.stripe.prices.list({
        lookup_keys: [lookupKey],
        active: true,
        limit: 1,
      });
      const price = prices.data[0];
      if (!price) {
        return err({
          code: "misconfigured",
          message: `No active Stripe price with lookup key "${lookupKey}". Run pnpm stripe:setup.`,
          retryable: false,
        });
      }
      const metadata = { workspace_id: request.workspaceId, plan: request.plan };
      const session = await this.stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: price.id, quantity: 1 }],
        customer_email: request.email,
        client_reference_id: request.workspaceId,
        metadata,
        subscription_data: { metadata },
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
      });
      return session.url
        ? ok({ url: session.url })
        : providerError("Stripe returned no checkout URL");
    } catch (error) {
      return providerError(error instanceof Error ? error.message : "Stripe request failed");
    }
  }
}
