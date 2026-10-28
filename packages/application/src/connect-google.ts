import {
  analyticsConnectionId,
  chooseGoogleProperties,
  createGoogleConnection,
  err,
  ok,
  type ProductId,
  type Result,
  type Workspace,
} from "@nuvantre/domain";
import type {
  AnalyticsConnectionRepository,
  AnalyticsProperties,
  AnalyticsPropertyLister,
  Clock,
  GoogleAuthError,
  GoogleAuthorizer,
  IdGenerator,
  ProductRepository,
  PropertyListError,
  TokenCipher,
  TokenGenerator,
} from "@nuvantre/ports";
import { failure, type UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";
import { founderOf, recordAudit, type AuditDeps } from "./audit";

/** Where Google sends the founder back after consent. Registered in the Google Cloud console. */
export const googleCallbackUrl = (appUrl: string) => `${appUrl}/api/google/callback`;

const notConnected = () => err(failure("analytics_not_connected", "Connect Google first"));

/** Starts Google's consent flow; the caller keeps `state` to check on the way back. */
export class StartGoogleConnect {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly googleAuth: GoogleAuthorizer;
      readonly tokens: TokenGenerator;
      readonly appUrl: string;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<Result<{ url: string; state: string }, UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const state = this.deps.tokens.generate();
    const url = this.deps.googleAuth.authorizationUrl({
      state,
      redirectUrl: googleCallbackUrl(this.deps.appUrl),
    });
    return ok({ url, state });
  }
}

/** Finishes the consent flow: checks the state, exchanges the code, stores the token encrypted. */
export class CompleteGoogleConnect {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly googleAuth: GoogleAuthorizer;
      readonly analyticsConnections: AnalyticsConnectionRepository;
      readonly cipher: TokenCipher;
      readonly ids: IdGenerator;
      readonly clock: Clock;
      readonly appUrl: string;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
    code: string;
    /** The state Google returned, and the one this browser was given when the flow started. */
    state: string;
    expectedState: string;
  }): Promise<Result<{ accountEmail: string }, UseCaseError | GoogleAuthError>> {
    if (input.expectedState === "" || input.state !== input.expectedState) {
      return err(
        failure("oauth_state_mismatch", "The Google sign-in could not be checked: try again"),
      );
    }
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const grant = await this.deps.googleAuth.exchangeCode({
      code: input.code,
      redirectUrl: googleCallbackUrl(this.deps.appUrl),
    });
    if (!grant.ok) return grant;

    const created = createGoogleConnection({
      id: analyticsConnectionId(this.deps.ids.next()),
      productId: product.value.id,
      accountEmail: grant.value.accountEmail,
      encryptedSecret: await this.deps.cipher.encrypt(grant.value.refreshToken),
      now: this.deps.clock.now(),
    });
    if (!created.ok) return created;
    // Reconnecting the same account (e.g. after a revoked token) keeps the chosen properties.
    const previous = await this.deps.analyticsConnections.find(product.value.id, "google");
    const connection =
      previous?.accountEmail === created.value.accountEmail
        ? {
            ...created.value,
            searchConsoleSite: previous.searchConsoleSite,
            ga4PropertyId: previous.ga4PropertyId,
          }
        : created.value;
    await this.deps.analyticsConnections.save(connection);
    return ok({ accountEmail: connection.accountEmail });
  }
}

export interface PropertyChoice {
  readonly searchConsoleSite: string | null;
  readonly ga4PropertyId: string | null;
}

/** The Search Console and GA4 properties the connected account can read, and the current choice. */
export class ListAnalyticsProperties {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly analyticsConnections: AnalyticsConnectionRepository;
      readonly cipher: TokenCipher;
      readonly propertyLister: AnalyticsPropertyLister;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<
    Result<
      { properties: AnalyticsProperties; chosen: PropertyChoice },
      UseCaseError | PropertyListError
    >
  > {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const connection = await this.deps.analyticsConnections.find(product.value.id, "google");
    if (!connection) return notConnected();
    const properties = await this.deps.propertyLister.list(
      await this.deps.cipher.decrypt(connection.encryptedSecret),
    );
    if (!properties.ok) return properties;
    const { searchConsoleSite, ga4PropertyId } = connection;
    return ok({ properties: properties.value, chosen: { searchConsoleSite, ga4PropertyId } });
  }
}

/** Records which Search Console and GA4 properties report for the product. */
export class ChooseAnalyticsProperties {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly analyticsConnections: AnalyticsConnectionRepository;
    } & AuditDeps,
  ) {}

  async execute(
    input: { workspace: Workspace; productId: ProductId } & PropertyChoice,
  ): Promise<Result<PropertyChoice, UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const connection = await this.deps.analyticsConnections.find(product.value.id, "google");
    if (!connection) return notConnected();
    const chosen = chooseGoogleProperties(connection, input);
    if (!chosen.ok) return chosen;
    await this.deps.analyticsConnections.save(chosen.value);
    await recordAudit(this.deps, {
      workspaceId: input.workspace.id,
      actor: founderOf(input.workspace),
      action: "analytics_connected",
      subject: { kind: "connection", id: chosen.value.id, label: "Google" },
    });
    const { searchConsoleSite, ga4PropertyId } = chosen.value;
    return ok({ searchConsoleSite, ga4PropertyId });
  }
}
