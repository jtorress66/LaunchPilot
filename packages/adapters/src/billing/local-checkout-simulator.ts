import { randomUUID } from "node:crypto";
import { err, ok, type PlanId, type Result, type WorkspaceId } from "@nuvantre/domain";
import { signLocalWebhook } from "./local-billing";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Plays the payment provider for the local checkout page: after "payment" it sends a signed
 * activation webhook to the app, exercising the same endpoint and verification path as Stripe.
 * Development and tests only.
 */
export class LocalCheckoutSimulator {
  static readonly signatureHeader = "x-nuvantre-signature";

  constructor(
    private readonly appUrl: string,
    private readonly secret: string,
    private readonly fetchFn: Fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async pay(input: { workspaceId: WorkspaceId; plan: PlanId }): Promise<Result<null, string>> {
    const { payload, signature } = signLocalWebhook(this.secret, {
      type: "subscription_activated",
      workspaceId: input.workspaceId,
      plan: input.plan,
      providerCustomerId: `cus_local_${input.workspaceId}`,
      providerSubscriptionId: `sub_local_${randomUUID()}`,
      currentPeriodEnd: null,
      occurredAt: this.now(),
    });
    const response = await this.fetchFn(`${this.appUrl}/api/billing/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [LocalCheckoutSimulator.signatureHeader]: signature,
      },
      body: payload,
    });
    return response.ok
      ? ok(null)
      : err(`The app rejected the local billing webhook (HTTP ${response.status})`);
  }
}
