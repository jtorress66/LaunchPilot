import { createHmac, timingSafeEqual } from "node:crypto";
import { err, ok, type BillingEvent, type Result } from "@nuvantre/domain";
import type {
  BillingError,
  BillingWebhookVerifier,
  CheckoutProvider,
  CheckoutRequest,
} from "@nuvantre/ports";

/**
 * Development and E2E stand-in for a payment provider. The checkout is a page inside the app that
 * posts an HMAC-signed webhook through the same verification path as a real provider.
 * Never enable it in production (the web config refuses to).
 */
export class LocalCheckoutProvider implements CheckoutProvider {
  constructor(private readonly appUrl: string) {}

  createCheckout(request: CheckoutRequest): Promise<Result<{ url: string }, BillingError>> {
    const url = new URL("/billing/local-checkout", this.appUrl);
    url.search = new URLSearchParams({
      workspace: request.workspaceId,
      plan: request.plan,
      email: request.email,
      success: request.successUrl,
      cancel: request.cancelUrl,
    }).toString();
    return Promise.resolve(ok({ url: url.toString() }));
  }
}

const hmac = (secret: string, payload: string) =>
  `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;

export const signLocalWebhook = (
  secret: string,
  event: BillingEvent | { readonly type: "local.ignored" },
): { payload: string; signature: string } => {
  const payload = JSON.stringify(event);
  return { payload, signature: hmac(secret, payload) };
};

const reviveDates = (_key: string, value: unknown): unknown =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : value;

export class LocalWebhookVerifier implements BillingWebhookVerifier {
  constructor(private readonly secret: string) {}

  verify(payload: string, signature: string): Promise<Result<BillingEvent | null, BillingError>> {
    const expected = Buffer.from(hmac(this.secret, payload));
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return Promise.resolve(
        err({
          code: "invalid_signature",
          message: "Local webhook signature is invalid",
          retryable: false,
        }),
      );
    }
    const event = JSON.parse(payload, reviveDates) as BillingEvent | { type: "local.ignored" };
    return Promise.resolve(ok(event.type === "local.ignored" ? null : event));
  }
}
