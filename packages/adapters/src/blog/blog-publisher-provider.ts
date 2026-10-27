import {
  blogPlatforms,
  err,
  ok,
  type BlogPlatform,
  type ChannelConnection,
  type ProductId,
  type Result,
} from "@nuvantre/domain";
import type {
  ChannelConnectionRepository,
  PublishError,
  Publisher,
  PublisherProvider,
  TokenCipher,
} from "@nuvantre/ports";

/** Builds one platform's publisher from a stored connection and its decrypted key. */
export type BlogPublisherFactory = (connection: ChannelConnection, secret: string) => Publisher;

export type BlogPublisherFactories = Partial<Record<BlogPlatform, BlogPublisherFactory>>;

/** The blog channel's provider: picks the factory of the platform the product connected. */
export class BlogPublisherProvider implements PublisherProvider {
  readonly channel = "blog" as const;

  constructor(
    private readonly connections: ChannelConnectionRepository,
    private readonly cipher: TokenCipher,
    private readonly factories: BlogPublisherFactories,
  ) {}

  async forProduct(productId: ProductId): Promise<Result<Publisher, PublishError>> {
    const connection = await this.connections.findByProductAndChannel(productId, this.channel);
    if (!connection) {
      return err({ code: "not_connected", message: "Connect your blog first", retryable: false });
    }
    const factory = this.factories[connection.provider];
    if (!factory) {
      const name = blogPlatforms[connection.provider].name;
      return err({
        code: "not_connected",
        message: `Publishing to ${name} is not available yet`,
        retryable: false,
      });
    }
    return ok(factory(connection, await this.cipher.decrypt(connection.encryptedSecret)));
  }
}
