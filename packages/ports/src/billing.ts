import type { BillingEvent, Email, PlanId, Result, WorkspaceId } from "@nuvantre/domain";
import type { PortError } from "./port-error";

export type BillingError = PortError<"provider_error" | "invalid_signature" | "misconfigured">;

export interface CheckoutRequest {
  readonly workspaceId: WorkspaceId;
  readonly plan: PlanId;
  readonly email: Email;
  readonly successUrl: string;
  readonly cancelUrl: string;
}

/** Starts a hosted checkout for a paid plan and returns where to send the founder. */
export interface CheckoutProvider {
  createCheckout(request: CheckoutRequest): Promise<Result<{ readonly url: string }, BillingError>>;
}

/**
 * Checks a webhook's signature and translates it into a provider-neutral BillingEvent.
 * Returns `null` for event types Nuvantre does not act on.
 */
export interface BillingWebhookVerifier {
  verify(payload: string, signature: string): Promise<Result<BillingEvent | null, BillingError>>;
}
