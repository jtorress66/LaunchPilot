import {
  analyticsConnectionId,
  createPlausibleConnection,
  ok,
  parseHttpUrl,
  type AnalyticsProvider,
  type ProductId,
  type Result,
  type Workspace,
} from "@launchpilot/domain";
import type {
  AnalyticsConnectionRepository,
  Clock,
  IdGenerator,
  PlausibleSiteVerifier,
  PlausibleVerifyError,
  ProductRepository,
  TokenCipher,
} from "@launchpilot/ports";
import type { UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

export const PLAUSIBLE_CLOUD = "https://plausible.io/";

/** Verifies a Plausible site and Stats API key, then stores the key encrypted. */
export class ConnectPlausible {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly analyticsConnections: AnalyticsConnectionRepository;
      readonly plausibleVerifier: PlausibleSiteVerifier;
      readonly cipher: TokenCipher;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
    siteId: string;
    apiKey: string;
    /** A self-hosted Plausible; null means plausible.io. */
    baseUrl: string | null;
  }): Promise<Result<{ siteId: string; baseUrl: string }, UseCaseError | PlausibleVerifyError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const baseUrl = parseHttpUrl(input.baseUrl ?? PLAUSIBLE_CLOUD);
    if (!baseUrl.ok) return baseUrl;
    const siteId = input.siteId.trim();
    const verified = await this.deps.plausibleVerifier.verify({
      baseUrl: baseUrl.value,
      siteId,
      apiKey: input.apiKey,
    });
    if (!verified.ok) return verified;

    const connection = createPlausibleConnection({
      id: analyticsConnectionId(this.deps.ids.next()),
      productId: product.value.id,
      siteId,
      baseUrl: baseUrl.value,
      encryptedSecret: await this.deps.cipher.encrypt(input.apiKey),
      now: this.deps.clock.now(),
    });
    if (!connection.ok) return connection;
    await this.deps.analyticsConnections.save(connection.value);
    return ok({ siteId: connection.value.siteId, baseUrl: connection.value.baseUrl });
  }
}

/** Forgets one provider's connection, and with it the stored secret. */
export class DisconnectAnalytics {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly analyticsConnections: AnalyticsConnectionRepository;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
    provider: AnalyticsProvider;
  }): Promise<Result<void, UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    await this.deps.analyticsConnections.delete(product.value.id, input.provider);
    return ok(undefined);
  }
}
