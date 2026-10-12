import {
  productId,
  socialChannels,
  socialProfileId,
  type SocialProfile,
} from "@launchpilot/domain";
import type { SocialProfileRow } from "../schema";
import { oneOf } from "./columns";

export const socialProfileMapper = {
  toRow: (profile: SocialProfile): SocialProfileRow => ({
    id: profile.id,
    product_id: profile.productId,
    provider: profile.provider,
    encrypted_profile_key: profile.encryptedProfileKey,
    ref_id: profile.refId,
    linked_channels: [...profile.linkedChannels],
    created_at: profile.createdAt,
  }),
  fromRow: (row: SocialProfileRow): SocialProfile => ({
    id: socialProfileId(row.id),
    productId: productId(row.product_id),
    provider: oneOf(["ayrshare"] as const, row.provider, "social_profiles.provider"),
    encryptedProfileKey: row.encrypted_profile_key,
    refId: row.ref_id,
    linkedChannels: row.linked_channels.map((channel) =>
      oneOf(socialChannels, channel, "social_profiles.linked_channels"),
    ),
    createdAt: row.created_at,
  }),
};
