import {
  productId,
  socialChannels,
  socialProfileId,
  type LinkedAccount,
  type SocialProfile,
} from "@launchpilot/domain";
import type { SocialProfileRow } from "../schema";
import { oneOf, readJson, toJson } from "./columns";

const COLUMN = "social_profiles.linked_accounts";

const readAccounts = (value: unknown): LinkedAccount[] => {
  const stored = readJson(value);
  if (!Array.isArray(stored)) throw new Error(`Unexpected value in ${COLUMN}`);
  return stored.map((entry: unknown) => {
    const { channel, accountId } = (entry ?? {}) as Partial<Record<string, unknown>>;
    if (typeof channel !== "string" || typeof accountId !== "string" || accountId === "") {
      throw new Error(`Unexpected value in ${COLUMN}`);
    }
    return { channel: oneOf(socialChannels, channel, COLUMN), accountId };
  });
};

export const socialProfileMapper = {
  toRow: (profile: SocialProfile): SocialProfileRow => ({
    id: profile.id,
    product_id: profile.productId,
    provider: profile.provider,
    external_profile_id: profile.externalProfileId,
    linked_accounts: toJson(profile.linkedAccounts),
    created_at: profile.createdAt,
  }),
  fromRow: (row: SocialProfileRow): SocialProfile => ({
    id: socialProfileId(row.id),
    productId: productId(row.product_id),
    provider: oneOf(["zernio"] as const, row.provider, "social_profiles.provider"),
    externalProfileId: row.external_profile_id,
    linkedAccounts: readAccounts(row.linked_accounts),
    createdAt: row.created_at,
  }),
};
