import {
  err,
  ok,
  type Channel,
  type PublishableContentItem,
  type Result,
} from "@launchpilot/domain";
import type { Clock, PublishError, PublishReceipt, Publisher } from "@launchpilot/ports";
import { FixedClock } from "./fixed-clock";
import { NextFailure } from "./next-failure";

/** Records published items instead of calling a platform. */
export class FakePublisher implements Publisher {
  readonly published: PublishableContentItem[] = [];
  private readonly failure = new NextFailure<PublishError>();

  constructor(
    readonly channel: Channel,
    private readonly clock: Clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z")),
  ) {}

  failNext(error: PublishError): void {
    this.failure.set(error);
  }

  publish(item: PublishableContentItem): Promise<Result<PublishReceipt, PublishError>> {
    const error = this.failure.take();
    if (error) return Promise.resolve(err(error));
    this.published.push(item);
    return Promise.resolve(
      ok({
        channel: this.channel,
        externalUrl: `https://example.com/${this.channel}/${item.id}`,
        publishedAt: this.clock.now(),
      }),
    );
  }
}
