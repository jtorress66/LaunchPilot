import { parseEmail, workspaceId } from "@launchpilot/domain";
import type { CheckoutProvider, CheckoutRequest } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";

export interface CheckoutProviderHarness {
  readonly provider: CheckoutProvider;
  /** Omit for a provider that has nothing that can fail (no network), e.g. the local one. */
  readonly givenFailure?: () => void | Promise<void>;
}

const email = parseEmail("founder@acme.dev");
if (!email.ok) throw new Error(email.error.message);

const request: CheckoutRequest = {
  workspaceId: workspaceId("ws_1"),
  plan: "starter",
  email: email.value,
  successUrl: "https://app.launchpilot.test/app/billing?checkout=success",
  cancelUrl: "https://app.launchpilot.test/app/billing?checkout=canceled",
};

export function describeCheckoutProviderContract(
  name: string,
  make: () => CheckoutProviderHarness | Promise<CheckoutProviderHarness>,
): void {
  describe(`CheckoutProvider contract: ${name}`, () => {
    it("returns an absolute http(s) URL to send the founder to", async () => {
      const { provider } = await make();
      const result = await provider.createCheckout(request);
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.url).toMatch(/^https?:\/\/\S+$/);
    });

    it("reports a provider failure as a BillingError result instead of throwing", async () => {
      const harness = await make();
      if (harness.givenFailure === undefined) return;
      await harness.givenFailure();
      const result = await harness.provider.createCheckout(request);
      expect(result.ok ? undefined : result.error.code).toBe("provider_error");
    });
  });
}
