import type { ProductId } from "@launchpilot/domain";
import type { PublisherProvider } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";

export interface PublisherProviderHarness {
  readonly provider: PublisherProvider;
  /** A product the harness has connected for the provider's channel. */
  readonly connected: ProductId;
  /** A product with no connection. */
  readonly unconnected: ProductId;
}

export function describePublisherProviderContract(
  name: string,
  make: () => PublisherProviderHarness | Promise<PublisherProviderHarness>,
): void {
  describe(`PublisherProvider contract: ${name}`, () => {
    it("gives a publisher for its own channel when the product is connected", async () => {
      const { provider, connected } = await make();
      const result = await provider.forProduct(connected);
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.channel).toBe(provider.channel);
    });

    it("reports not_connected for a product without a connection", async () => {
      const { provider, unconnected } = await make();
      expect(await provider.forProduct(unconnected)).toMatchObject({
        ok: false,
        error: { code: "not_connected", retryable: false },
      });
    });
  });
}
