import Stripe from "stripe";

/** The one place a Stripe client is configured: fetch-based, with SDK retries for transient errors. */
export const createStripeClient = (secretKey: string): Stripe =>
  new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2 });
