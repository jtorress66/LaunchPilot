import {
  createSocialProfile,
  err,
  ok,
  socialProfileId,
  withLinkedAccounts,
  type ProductId,
  type Result,
  type SocialChannel,
  type SocialProfile,
  type Workspace,
} from "@nuvantre/domain";
import type {
  Clock,
  IdGenerator,
  ProductRepository,
  SocialAccountLinker,
  SocialLinkError,
  SocialProfileRepository,
} from "@nuvantre/ports";
import { failure, type UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

interface Deps {
  readonly products: ProductRepository;
  readonly socialProfiles: SocialProfileRepository;
  readonly linker: SocialAccountLinker;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/**
 * Gives the founder the provider's page for linking one channel. The product's profile is
 * created on first use; Nuvantre never sees the founder's passwords.
 */
export class ConnectSocial {
  constructor(private readonly deps: Deps) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
    channel: SocialChannel;
    returnUrl: string;
  }): Promise<Result<{ url: string }, UseCaseError | SocialLinkError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const existing = await this.deps.socialProfiles.findByProduct(product.value.id);
    const profile = existing
      ? ok(existing)
      : await this.createProfile(product.value.id, product.value.name);
    if (!profile.ok) return profile;
    const url = await this.deps.linker.linkingUrl(
      profile.value.externalProfileId,
      input.channel,
      input.returnUrl,
    );
    return url.ok ? ok({ url: url.value }) : url;
  }

  private async createProfile(
    productId: ProductId,
    name: string,
  ): Promise<Result<SocialProfile, UseCaseError | SocialLinkError>> {
    // The product id doubles as the provider-side external id, so a retry finds the same profile.
    const created = await this.deps.linker.createProfile(name, productId);
    if (!created.ok) return created;
    const profile = createSocialProfile({
      id: socialProfileId(this.deps.ids.next()),
      productId,
      externalProfileId: created.value.profileId,
      now: this.deps.clock.now(),
    });
    if (profile.ok) await this.deps.socialProfiles.save(profile.value);
    return profile;
  }
}

/** Reads which accounts the founder linked on the provider's page and stores them. */
export class RefreshSocialLinks {
  constructor(private readonly deps: Deps) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<Result<SocialProfile, UseCaseError | SocialLinkError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const profile = await this.deps.socialProfiles.findByProduct(product.value.id);
    if (!profile) {
      return err(failure("social_not_connected", "Connect X or LinkedIn first"));
    }
    const accounts = await this.deps.linker.linkedAccounts(profile.externalProfileId);
    if (!accounts.ok) return accounts;
    const updated = withLinkedAccounts(profile, accounts.value);
    await this.deps.socialProfiles.save(updated);
    return ok(updated);
  }
}
