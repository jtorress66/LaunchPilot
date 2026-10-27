import { err, ok, type PlanId, type Result, type WorkspaceId } from "@nuvantre/domain";
import { signLocalWebhook } from "./local-billing";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Plays the payment provider for the local checkout page: after "payment" it sends a signed
 * activation webhook to the app, exercising the same endpoint and verification path as Stripe.
 * It can also cancel, e.g. to see a downgrade. Development and tests only.
 */
/** One local subscription per workspace, so a later cancel finds it. */
const subscriptionIdOf = (workspaceId: WorkspaceId) => `sub_local_${workspaceId}`;

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
      providerSubscriptionId: subscriptionIdOf(input.workspaceId),
      currentPeriodEnd: null,
      occurredAt: this.now(),
    });
    return this.send(payload, signature);
  }

  /** As if the founder cancelled: the plan drops to Free. */
  async cancel(input: { workspaceId: WorkspaceId }): Promise<Result<null, string>> {
    const { payload, signature } = signLocalWebhook(this.secret, {
      type: "subscription_canceled",
      providerSubscriptionId: subscriptionIdOf(input.workspaceId),
      occurredAt: this.now(),
    });
    return this.send(payload, signature);
  }

  private async send(payload: string, signature: string): Promise<Result<null, string>> {
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
