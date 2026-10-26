import {
  applyBillingEvent,
  err,
  ok,
  type BillingEvent,
  type Result,
  type Subscription,
} from "@nuvantre/domain";
import type { BillingWebhookVerifier, SubscriptionRepository } from "@nuvantre/ports";
import { failure, type UseCaseError } from "./errors";

export interface HandleBillingWebhookDeps {
  readonly verifier: BillingWebhookVerifier;
  readonly subscriptions: SubscriptionRepository;
}

/**
 * Applies a verified billing webhook to the workspace's subscription. Replaying an event is
 * harmless; an error tells the provider to retry later (e.g. an update arriving before activation).
 */
export class HandleBillingWebhook {
  constructor(private readonly deps: HandleBillingWebhookDeps) {}

  async execute(input: {
    payload: string;
    signature: string;
  }): Promise<Result<{ handled: boolean }, UseCaseError>> {
    const verified = await this.deps.verifier.verify(input.payload, input.signature);
    if (!verified.ok) return err(failure("invalid_signature", "Webhook signature is invalid"));
    const event = verified.value;
    if (event === null) return ok({ handled: false });

    const subscription = await this.find(event);
    if (!subscription.ok) return subscription;
    await this.deps.subscriptions.save(applyBillingEvent(subscription.value, event));
    return ok({ handled: true });
  }

  private async find(event: BillingEvent): Promise<Result<Subscription, UseCaseError>> {
    if (event.type === "subscription_activated") {
      const found = await this.deps.subscriptions.findByWorkspace(event.workspaceId);
      return found
        ? ok(found)
        : err(failure("workspace_not_found", "Unknown workspace in billing event"));
    }
    const found = await this.deps.subscriptions.findByProviderSubscriptionId(
      event.providerSubscriptionId,
    );
    return found
      ? ok(found)
      : err(failure("subscription_not_found", "Unknown subscription in billing event"));
  }
}
