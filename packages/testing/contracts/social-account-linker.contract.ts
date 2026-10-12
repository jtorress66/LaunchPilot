import { socialChannels } from "@launchpilot/domain";
import type { SocialAccountLinker } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";

export interface SocialAccountLinkerHarness {
  readonly linker: SocialAccountLinker;
  /** A profile key the provider does not know. */
  readonly unknownProfileKey: string;
}

export function describeSocialAccountLinkerContract(
  name: string,
  make: () => SocialAccountLinkerHarness | Promise<SocialAccountLinkerHarness>,
): void {
  describe(`SocialAccountLinker contract: ${name}`, () => {
    it("creates a profile with a key and a reference", async () => {
      const { linker } = await make();
      const result = await linker.createProfile("Acme Analytics");
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.profileKey.trim()).not.toBe("");
      expect(result.value.refId.trim()).not.toBe("");
    });

    it("gives an https linking page for a profile", async () => {
      const { linker } = await make();
      const created = await linker.createProfile("Acme Analytics");
      if (!created.ok) throw new Error(created.error.message);
      const url = await linker.linkingUrl(created.value.profileKey, "https://app.test/back");
      if (!url.ok) throw new Error(url.error.message);
      expect(url.value).toMatch(/^https?:\/\//);
    });

    it("lists only social channels as linked", async () => {
      const { linker } = await make();
      const created = await linker.createProfile("Acme Analytics");
      if (!created.ok) throw new Error(created.error.message);
      const linked = await linker.linkedChannels(created.value.profileKey);
      if (!linked.ok) throw new Error(linked.error.message);
      for (const channel of linked.value) expect(socialChannels).toContain(channel);
    });

    it("rejects an unknown profile key without echoing it", async () => {
      const { linker, unknownProfileKey } = await make();
      const result = await linker.linkedChannels(unknownProfileKey);
      expect(result).toMatchObject({ ok: false, error: { code: "rejected", retryable: false } });
      if (result.ok) return;
      expect(result.error.message).not.toContain(unknownProfileKey);
    });
  });
}
