import { workspaceId, type BillingEvent } from "@nuvantre/domain";
import type { BillingWebhookVerifier } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";

export interface SignedWebhook {
  readonly payload: string;
  readonly signature: string;
}

export interface BillingWebhookVerifierHarness {
  readonly verifier: BillingWebhookVerifier;
  /** Produce a webhook the provider would send for this event, signed with the verifier's secret. */
  sign(event: BillingEvent): SignedWebhook | Promise<SignedWebhook>;
  /** A correctly signed webhook for an event type Nuvantre ignores. */
  signIgnored(): SignedWebhook | Promise<SignedWebhook>;
}

// Whole seconds: providers such as Stripe use Unix timestamps.
const at = new Date("2026-05-02T10:00:00.000Z");
const periodEnd = new Date("2026-06-02T10:00:00.000Z");

export const sampleBillingEvents: readonly BillingEvent[] = [
  {
    type: "subscription_activated",
    workspaceId: workspaceId("ws_1"),
    plan: "starter",
    providerCustomerId: "cus_123",
    providerSubscriptionId: "sub_123",
    currentPeriodEnd: null,
    occurredAt: at,
  },
  {
    type: "subscription_updated",
    providerSubscriptionId: "sub_123",
    plan: "growth",
    status: "past_due",
    currentPeriodEnd: periodEnd,
    occurredAt: at,
  },
  { type: "subscription_canceled", providerSubscriptionId: "sub_123", occurredAt: at },
];

export function describeBillingWebhookVerifierContract(
  name: string,
  make: () => BillingWebhookVerifierHarness | Promise<BillingWebhookVerifierHarness>,
): void {
  describe(`BillingWebhookVerifier contract: ${name}`, () => {
    it.each(sampleBillingEvents)("translates a correctly signed $type webhook", async (event) => {
      const harness = await make();
      const { payload, signature } = await harness.sign(event);
      expect(await harness.verifier.verify(payload, signature)).toEqual({ ok: true, value: event });
    });

    it("refuses a payload that was changed after signing", async () => {
      const harness = await make();
      const [first] = sampleBillingEvents;
      if (!first) throw new Error("no sample");
      const { payload, signature } = await harness.sign(first);
      const result = await harness.verifier.verify(payload.replace("starter", "growth"), signature);
      expect(result.ok ? undefined : result.error.code).toBe("invalid_signature");
    });

    it("refuses a missing or forged signature", async () => {
      const harness = await make();
      const [first] = sampleBillingEvents;
      if (!first) throw new Error("no sample");
      const { payload } = await harness.sign(first);
      for (const signature of ["", "forged"]) {
        const result = await harness.verifier.verify(payload, signature);
        expect(result.ok ? undefined : result.error.code).toBe("invalid_signature");
      }
    });

    it("returns null for an event type Nuvantre ignores", async () => {
      const harness = await make();
      const { payload, signature } = await harness.signIgnored();
      expect(await harness.verifier.verify(payload, signature)).toEqual({ ok: true, value: null });
    });
  });
}
