import { err, ok, type ProductId, type Result } from "@launchpilot/domain";
import type {
  ChannelConnectionRepository,
  Clock,
  PublishError,
  Publisher,
  PublisherProvider,
  TokenCipher,
} from "@launchpilot/ports";
import type { WordPressNetwork } from "./rest";
import { WordPressPublisher } from "./wordpress-publisher";

/** Builds a WordPressPublisher from a product's stored, encrypted blog connection. */
export class WordPressPublisherProvider implements PublisherProvider {
  readonly channel = "blog" as const;

  constructor(
    private readonly connections: ChannelConnectionRepository,
    private readonly cipher: TokenCipher,
    private readonly options: WordPressNetwork & { readonly clock: Clock },
  ) {}

  async forProduct(productId: ProductId): Promise<Result<Publisher, PublishError>> {
    const connection = await this.connections.findByProductAndChannel(productId, this.channel);
    if (!connection) {
      return err({ code: "not_connected", message: "Connect your blog first", retryable: false });
    }
    const password = await this.cipher.decrypt(connection.encryptedSecret);
    return ok(
      new WordPressPublisher(
        { siteUrl: connection.siteUrl, username: connection.username, password },
        this.options,
      ),
    );
  }
}
