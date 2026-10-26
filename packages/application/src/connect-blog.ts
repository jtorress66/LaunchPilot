import {
  channelConnectionId,
  createBlogConnection,
  ok,
  type ProductId,
  type Result,
  type Workspace,
} from "@nuvantre/domain";
import type {
  BlogConnectionVerifier,
  ChannelConnectionRepository,
  Clock,
  ConnectionError,
  IdGenerator,
  ProductRepository,
  TokenCipher,
} from "@nuvantre/ports";
import type { UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

export interface ConnectedBlog {
  readonly siteName: string;
  readonly siteUrl: string;
  readonly username: string;
}

/** Verifies a WordPress blog and stores its Application Password encrypted. */
export class ConnectBlog {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly connections: ChannelConnectionRepository;
      readonly blogVerifier: BlogConnectionVerifier;
      readonly cipher: TokenCipher;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
    siteUrl: string;
    username: string;
    secret: string;
  }): Promise<Result<ConnectedBlog, UseCaseError | ConnectionError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const verified = await this.deps.blogVerifier.verify(input);
    if (!verified.ok) return verified;

    const connection = createBlogConnection({
      id: channelConnectionId(this.deps.ids.next()),
      productId: product.value.id,
      siteUrl: verified.value.siteUrl,
      siteName: verified.value.siteName,
      username: input.username,
      encryptedSecret: await this.deps.cipher.encrypt(input.secret),
      now: this.deps.clock.now(),
    });
    if (!connection.ok) return connection;
    await this.deps.connections.save(connection.value);
    const { siteName, siteUrl, username } = connection.value;
    return ok({ siteName, siteUrl, username });
  }
}
