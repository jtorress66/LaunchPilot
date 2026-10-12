import { err, ok, type ProductId, type Result, type SocialChannel } from "@launchpilot/domain";
import type {
  PublishError,
  Publisher,
  PublisherProvider,
  SocialProfileRepository,
} from "@launchpilot/ports";
import { channelNames, type ZernioOptions } from "./api";
import { ZernioPublisher } from "./zernio-publisher";

/** Builds a ZernioPublisher for one channel from the account the product linked. */
export class ZernioPublisherProvider implements PublisherProvider {
  constructor(
    readonly channel: SocialChannel,
    private readonly profiles: SocialProfileRepository,
    private readonly options: ZernioOptions,
  ) {}

  async forProduct(productId: ProductId): Promise<Result<Publisher, PublishError>> {
    const profile = await this.profiles.findByProduct(productId);
    const account = profile?.linkedAccounts.find((a) => a.channel === this.channel);
    if (!account) {
      return err({
        code: "not_connected",
        message: `Link your ${channelNames[this.channel]} account first`,
        retryable: false,
      });
    }
    return ok(new ZernioPublisher(this.channel, account.accountId, this.options));
  }
}
