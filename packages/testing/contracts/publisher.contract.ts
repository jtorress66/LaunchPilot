import type { Publisher } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";
import { aPublishableItem } from "../src/fixtures/entities";

export interface PublisherHarness {
  readonly publisher: Publisher;
  givenOutage(): void | Promise<void>;
}

export function describePublisherContract(
  name: string,
  make: () => PublisherHarness | Promise<PublisherHarness>,
): void {
  describe(`Publisher contract: ${name}`, () => {
    it("returns a receipt for its own channel with a public http(s) URL", async () => {
      const { publisher } = await make();
      const result = await publisher.publish(aPublishableItem(publisher.channel));
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.channel).toBe(publisher.channel);
      expect(result.value.externalUrl).toMatch(/^https?:\/\//);
      expect(result.value.publishedAt).toBeInstanceOf(Date);
    });

    it("reports an outage as a PublishError result instead of throwing", async () => {
      const harness = await make();
      await harness.givenOutage();
      const result = await harness.publisher.publish(aPublishableItem(harness.publisher.channel));
      expect(result.ok).toBe(false);
    });
  });
}
