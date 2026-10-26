import { err, ok, type Channel, type ProductId, type Result } from "@nuvantre/domain";
import type { Clock, PublishError, Publisher, PublisherProvider } from "@nuvantre/ports";
import { FakePublisher } from "./fake-publisher";

/** Hands out one shared FakePublisher for connected products, so tests can inspect it. */
export class FakePublisherProvider implements PublisherProvider {
  readonly publisher: FakePublisher;
  private readonly connected = new Set<ProductId>();

  constructor(
    readonly channel: Channel,
    clock?: Clock,
  ) {
    this.publisher = new FakePublisher(channel, clock);
  }

  connect(productId: ProductId): this {
    this.connected.add(productId);
    return this;
  }

  forProduct(productId: ProductId): Promise<Result<Publisher, PublishError>> {
    return Promise.resolve(
      this.connected.has(productId)
        ? ok(this.publisher)
        : err({
            code: "not_connected",
            message: `Connect your ${this.channel} first`,
            retryable: false,
          }),
    );
  }
}
