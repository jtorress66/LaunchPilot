import {
  channelConnectionId,
  createBlogConnection,
  ok,
  type BlogPlatform,
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
  readonly platform: BlogPlatform;
  readonly siteName: string;
  readonly siteUrl: string;
}

/** Verifies a blog on any supported platform and stores its key encrypted. */
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
    platform: BlogPlatform;
    siteUrl: string;
    settings: Readonly<Record<string, string>>;
    secret: string;
  }): Promise<Result<ConnectedBlog, UseCaseError | ConnectionError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const { platform, siteUrl, settings, secret } = input;
    const verified = await this.deps.blogVerifier.verify({ platform, siteUrl, settings, secret });
    if (!verified.ok) return verified;

    const connection = createBlogConnection({
      id: channelConnectionId(this.deps.ids.next()),
      productId: product.value.id,
      platform,
      siteUrl: verified.value.siteUrl,
      siteName: verified.value.siteName,
      // What the founder typed, plus what the platform looked up (a Shopify blog, Webflow fields).
      settings: { ...settings, ...verified.value.settings },
      encryptedSecret: await this.deps.cipher.encrypt(secret),
      now: this.deps.clock.now(),
    });
    if (!connection.ok) return connection;
    await this.deps.connections.save(connection.value);
    const { provider, siteName } = connection.value;
    return ok({ platform: provider, siteName, siteUrl: connection.value.siteUrl });
  }
}
