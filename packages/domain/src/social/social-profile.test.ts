import { describe, expect, it } from "vitest";
import { productId, socialProfileId } from "../shared/ids";
import { createSocialProfile, withLinkedChannels } from "./social-profile";

const now = new Date("2026-10-12T00:00:00.000Z");
const profile = () => {
  const result = createSocialProfile({
    id: socialProfileId("sp_1"),
    productId: productId("prod_1"),
    encryptedProfileKey: "v1:ciphertext",
    refId: "ref_123",
    now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("social profile", () => {
  it("starts with no linked channels", () => {
    expect(profile()).toEqual({
      id: "sp_1",
      productId: "prod_1",
      provider: "ayrshare",
      encryptedProfileKey: "v1:ciphertext",
      refId: "ref_123",
      linkedChannels: [],
      createdAt: now,
    });
  });

  it("refuses a missing profile key", () => {
    const result = createSocialProfile({
      id: socialProfileId("sp_1"),
      productId: productId("prod_1"),
      encryptedProfileKey: " ",
      refId: "ref",
      now,
    });
    expect(result.ok ? undefined : result.error.code).toBe("invalid_text");
  });

  it("records which channels are linked, deduplicated and in a stable order", () => {
    expect(withLinkedChannels(profile(), ["linkedin", "x", "x"]).linkedChannels).toEqual([
      "x",
      "linkedin",
    ]);
  });
});
