import { describe, expect, it } from "vitest";
import { productId, socialProfileId } from "../shared/ids";
import {
  createSocialProfile,
  linkedChannels,
  withLinkedAccounts,
  type SocialProfile,
} from "./social-profile";

const now = new Date("2026-10-12T00:00:00.000Z");
const profile = (): SocialProfile => {
  const result = createSocialProfile({
    id: socialProfileId("sp_1"),
    productId: productId("prod_1"),
    externalProfileId: "zp_123",
    now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("social profile", () => {
  it("starts with no linked accounts", () => {
    expect(profile()).toEqual({
      id: "sp_1",
      productId: "prod_1",
      provider: "zernio",
      externalProfileId: "zp_123",
      linkedAccounts: [],
      createdAt: now,
    });
    expect(linkedChannels(profile())).toEqual([]);
  });

  it("refuses a missing provider profile id", () => {
    const result = createSocialProfile({
      id: socialProfileId("sp_1"),
      productId: productId("prod_1"),
      externalProfileId: " ",
      now,
    });
    expect(result.ok ? undefined : result.error.code).toBe("invalid_text");
  });

  it("keeps one account per channel, X first, and derives the linked channels", () => {
    const linked = withLinkedAccounts(profile(), [
      { channel: "linkedin", accountId: "acc_li" },
      { channel: "x", accountId: "acc_x" },
      { channel: "x", accountId: "acc_x_older" },
    ]);
    expect(linked.linkedAccounts).toEqual([
      { channel: "x", accountId: "acc_x" },
      { channel: "linkedin", accountId: "acc_li" },
    ]);
    expect(linkedChannels(linked)).toEqual(["x", "linkedin"]);
  });
});
