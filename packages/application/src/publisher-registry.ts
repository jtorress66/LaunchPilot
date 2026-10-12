import { err, type Channel, type ProductId, type Result } from "@launchpilot/domain";
import type { PublishError, Publisher, PublisherProvider } from "@launchpilot/ports";

/**
 * One PublisherProvider per channel. Supporting a new channel means registering its
 * provider in the composition root; no use case branches on channel type.
 */
export class PublisherRegistry {
  private readonly providers: ReadonlyMap<Channel, PublisherProvider>;

  constructor(providers: readonly PublisherProvider[]) {
    this.providers = new Map(providers.map((provider) => [provider.channel, provider]));
  }

  forProduct(channel: Channel, productId: ProductId): Promise<Result<Publisher, PublishError>> {
    const provider = this.providers.get(channel);
    if (!provider) {
      return Promise.resolve(
        err({
          code: "not_connected",
          message: `Publishing to ${channel} is not available yet`,
          retryable: false,
        }),
      );
    }
    return provider.forProduct(productId);
  }
}
