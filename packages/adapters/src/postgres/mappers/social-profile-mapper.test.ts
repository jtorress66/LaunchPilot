import { withLinkedChannels } from "@launchpilot/domain";
import { aSocialProfile } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { socialProfileMapper } from "./social-profile-mapper";

describe("socialProfileMapper", () => {
  it("round-trips a profile with linked channels, keeping the key encrypted", () => {
    const profile = withLinkedChannels(aSocialProfile(), ["x", "linkedin"]);
    const row = socialProfileMapper.toRow(profile);
    expect(row).toMatchObject({
      product_id: "prod_1",
      provider: "ayrshare",
      encrypted_profile_key: "v1:fixture-profile-key",
      ref_id: "ref_fixture",
      linked_channels: ["x", "linkedin"],
    });
    expect(socialProfileMapper.fromRow(row)).toEqual(profile);
  });

  it.each([
    ["an unknown provider", { provider: "buffer" }, /social_profiles\.provider/],
    [
      "an unknown linked channel",
      { linked_channels: ["tiktok"] },
      /social_profiles\.linked_channels/,
    ],
  ])("refuses %s", (_case, override, message) => {
    const row = { ...socialProfileMapper.toRow(aSocialProfile()), ...override };
    expect(() => socialProfileMapper.fromRow(row)).toThrow(message);
  });
});
