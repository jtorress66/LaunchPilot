import { withLinkedAccounts } from "@nuvantre/domain";
import { aSocialProfile } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { socialProfileMapper } from "./social-profile-mapper";

describe("socialProfileMapper", () => {
  it("round-trips a profile with its linked accounts", () => {
    const profile = withLinkedAccounts(aSocialProfile(), [
      { channel: "x", accountId: "acc_x" },
      { channel: "linkedin", accountId: "acc_li" },
    ]);
    const row = socialProfileMapper.toRow(profile);
    expect(row).toMatchObject({
      product_id: "prod_1",
      provider: "zernio",
      external_profile_id: "zp_fixture",
    });
    expect(JSON.parse(row.linked_accounts)).toEqual([
      { channel: "x", accountId: "acc_x" },
      { channel: "linkedin", accountId: "acc_li" },
    ]);
    expect(socialProfileMapper.fromRow(row)).toEqual(profile);
  });

  it.each([
    ["an unknown provider", { provider: "ayrshare" }, /social_profiles\.provider/],
    [
      "an unknown linked channel",
      { linked_accounts: JSON.stringify([{ channel: "tiktok", accountId: "a" }]) },
      /social_profiles\.linked_accounts/,
    ],
    [
      "a linked account without an id",
      { linked_accounts: JSON.stringify([{ channel: "x" }]) },
      /social_profiles\.linked_accounts/,
    ],
  ])("refuses %s", (_case, override, message) => {
    const row = { ...socialProfileMapper.toRow(aSocialProfile()), ...override };
    expect(() => socialProfileMapper.fromRow(row)).toThrow(message);
  });
});
