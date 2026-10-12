import {
  createSocialProfile,
  err,
  ok,
  socialProfileId,
  type ProductId,
  type Result,
  type SocialProfile,
  type Workspace,
  withLinkedChannels,
} from "@launchpilot/domain";
import type {
  Clock,
  IdGenerator,
  ProductRepository,
  SocialAccountLinker,
  SocialLinkError,
  SocialProfileRepository,
  TokenCipher,
} from "@launchpilot/ports";
import { failure, type UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

interface Deps {
  readonly products: ProductRepository;
  readonly socialProfiles: SocialProfileRepository;
  readonly linker: SocialAccountLinker;
  readonly cipher: TokenCipher;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/**
 * Gives the founder the provider's linking page for X and LinkedIn. The product's profile
 * is created on first use and its key stored encrypted; LaunchPilot never sees passwords.
 */
export class ConnectSocial {
  constructor(private readonly deps: Deps) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
    returnUrl: string;
  }): Promise<Result<{ url: string }, UseCaseError | SocialLinkError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const existing = await this.deps.socialProfiles.findByProduct(product.value.id);
    const profile = existing
      ? ok(existing)
      : await this.createProfile(product.value.id, product.value.name);
    if (!profile.ok) return profile;
    const profileKey = await this.deps.cipher.decrypt(profile.value.encryptedProfileKey);
    const url = await this.deps.linker.linkingUrl(profileKey, input.returnUrl);
    return url.ok ? ok({ url: url.value }) : url;
  }

  private async createProfile(
    productId: ProductId,
    title: string,
  ): Promise<Result<SocialProfile, UseCaseError | SocialLinkError>> {
    const created = await this.deps.linker.createProfile(title);
    if (!created.ok) return created;
    const profile = createSocialProfile({
      id: socialProfileId(this.deps.ids.next()),
      productId,
      encryptedProfileKey: await this.deps.cipher.encrypt(created.value.profileKey),
      refId: created.value.refId,
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
      return err(failure("social_not_connected", "Connect X and LinkedIn first"));
    }
    const profileKey = await this.deps.cipher.decrypt(profile.encryptedProfileKey);
    const channels = await this.deps.linker.linkedChannels(profileKey);
    if (!channels.ok) return channels;
    const updated = withLinkedChannels(profile, channels.value);
    await this.deps.socialProfiles.save(updated);
    return ok(updated);
  }
}
