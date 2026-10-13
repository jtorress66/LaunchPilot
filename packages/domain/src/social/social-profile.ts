import { map, type Result } from "../result";
import type { DomainError } from "../shared/errors";
import type { ProductId, SocialProfileId } from "../shared/ids";
import { nonEmptyText } from "../shared/text";

/** Channels published through the unified social API, in display order. */
export const socialChannels = ["x", "linkedin"] as const;
export type SocialChannel = (typeof socialChannels)[number];

/** One linked platform account, as the social API identifies it. */
export interface LinkedAccount {
  readonly channel: SocialChannel;
  readonly accountId: string;
}

/**
 * A product's profile at the unified social API; the founder links X and LinkedIn to it.
 * It holds no secret: the API key lives in configuration only.
 */
export interface SocialProfile {
  readonly id: SocialProfileId;
  readonly productId: ProductId;
  readonly provider: "zernio";
  /** The provider's id for the profile. */
  readonly externalProfileId: string;
  readonly linkedAccounts: readonly LinkedAccount[];
  readonly createdAt: Date;
}

export const createSocialProfile = (input: {
  id: SocialProfileId;
  productId: ProductId;
  externalProfileId: string;
  now: Date;
}): Result<SocialProfile, DomainError> =>
  map(nonEmptyText(input.externalProfileId, { field: "Profile id", max: 200 }), (externalId) => ({
    id: input.id,
    productId: input.productId,
    provider: "zernio" as const,
    externalProfileId: externalId,
    linkedAccounts: [],
    createdAt: input.now,
  }));

/** Records the linked accounts: the first one listed per channel wins, in display order. */
export const withLinkedAccounts = (
  profile: SocialProfile,
  accounts: readonly LinkedAccount[],
): SocialProfile => ({
  ...profile,
  linkedAccounts: socialChannels.flatMap((channel) => {
    const account = accounts.find((a) => a.channel === channel);
    return account ? [{ channel, accountId: account.accountId }] : [];
  }),
});

export const linkedChannels = (profile: SocialProfile): readonly SocialChannel[] =>
  profile.linkedAccounts.map((account) => account.channel);
