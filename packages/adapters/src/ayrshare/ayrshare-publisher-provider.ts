import { err, ok, type ProductId, type Result, type SocialChannel } from "@launchpilot/domain";
import type {
  PublishError,
  Publisher,
  PublisherProvider,
  SocialProfileRepository,
  TokenCipher,
} from "@launchpilot/ports";
import type { AyrshareOptions } from "./api";
import { AyrsharePublisher } from "./ayrshare-publisher";

const names: Readonly<Record<SocialChannel, string>> = { x: "X", linkedin: "LinkedIn" };

/** Builds an AyrsharePublisher for one channel from a product's stored, encrypted profile key. */
export class AyrsharePublisherProvider implements PublisherProvider {
  constructor(
    readonly channel: SocialChannel,
    private readonly profiles: SocialProfileRepository,
    private readonly cipher: TokenCipher,
    private readonly options: AyrshareOptions,
  ) {}

  async forProduct(productId: ProductId): Promise<Result<Publisher, PublishError>> {
    const profile = await this.profiles.findByProduct(productId);
    if (!profile?.linkedChannels.includes(this.channel)) {
      return err({
        code: "not_connected",
        message: `Link your ${names[this.channel]} account first`,
        retryable: false,
      });
    }
    const profileKey = await this.cipher.decrypt(profile.encryptedProfileKey);
    return ok(new AyrsharePublisher(this.channel, profileKey, this.options));
  }
}
