import { map, type Result } from "../result";
import type { DomainError } from "../shared/errors";
import type { ProductId, SocialProfileId } from "../shared/ids";
import { nonEmptyText } from "../shared/text";

/** Channels published through the unified social API, in display order. */
export const socialChannels = ["x", "linkedin"] as const;
export type SocialChannel = (typeof socialChannels)[number];

/** A product's account at the unified social API; the founder links X and LinkedIn to it. */
export interface SocialProfile {
  readonly id: SocialProfileId;
  readonly productId: ProductId;
  readonly provider: "ayrshare";
  /** Encrypted at rest; only the publishing adapter ever decrypts it. */
  readonly encryptedProfileKey: string;
  /** The provider's reference for the profile, safe to show and log. */
  readonly refId: string;
  readonly linkedChannels: readonly SocialChannel[];
  readonly createdAt: Date;
}

export const createSocialProfile = (input: {
  id: SocialProfileId;
  productId: ProductId;
  encryptedProfileKey: string;
  refId: string;
  now: Date;
}): Result<SocialProfile, DomainError> =>
  map(nonEmptyText(input.encryptedProfileKey, { field: "Profile key", max: 4000 }), (key) => ({
    id: input.id,
    productId: input.productId,
    provider: "ayrshare" as const,
    encryptedProfileKey: key,
    refId: input.refId,
    linkedChannels: [],
    createdAt: input.now,
  }));

export const withLinkedChannels = (
  profile: SocialProfile,
  linked: readonly SocialChannel[],
): SocialProfile => ({
  ...profile,
  linkedChannels: socialChannels.filter((channel) => linked.includes(channel)),
});
