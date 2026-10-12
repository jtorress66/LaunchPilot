import { socialChannels } from "@launchpilot/domain";
import type { SocialAccountLinker } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";

export interface SocialAccountLinkerHarness {
  readonly linker: SocialAccountLinker;
  /** A profile id the provider does not know. */
  readonly unknownProfileId: string;
}

export function describeSocialAccountLinkerContract(
  name: string,
  make: () => SocialAccountLinkerHarness | Promise<SocialAccountLinkerHarness>,
): void {
  describe(`SocialAccountLinker contract: ${name}`, () => {
    it("creates a profile once per product: creating it again returns the same id", async () => {
      const { linker } = await make();
      const first = await linker.createProfile("Acme Analytics", "prod_1");
      const again = await linker.createProfile("Acme Analytics", "prod_1");
      if (!first.ok || !again.ok) throw new Error("createProfile failed");
      expect(first.value.profileId.trim()).not.toBe("");
      expect(again.value.profileId).toBe(first.value.profileId);
    });

    it("gives an http(s) linking page for each channel", async () => {
      const { linker } = await make();
      const created = await linker.createProfile("Acme Analytics", "prod_1");
      if (!created.ok) throw new Error(created.error.message);
      for (const channel of socialChannels) {
        const url = await linker.linkingUrl(
          created.value.profileId,
          channel,
          "https://app.test/back",
        );
        if (!url.ok) throw new Error(url.error.message);
        expect(url.value).toMatch(/^https?:\/\//);
      }
    });

    it("lists only social channels as linked accounts", async () => {
      const { linker } = await make();
      const created = await linker.createProfile("Acme Analytics", "prod_1");
      if (!created.ok) throw new Error(created.error.message);
      const linked = await linker.linkedAccounts(created.value.profileId);
      if (!linked.ok) throw new Error(linked.error.message);
      for (const account of linked.value) {
        expect(socialChannels).toContain(account.channel);
        expect(account.accountId.trim()).not.toBe("");
      }
    });

    it("rejects an unknown profile without echoing its id", async () => {
      const { linker, unknownProfileId } = await make();
      const result = await linker.linkedAccounts(unknownProfileId);
      expect(result).toMatchObject({ ok: false, error: { code: "rejected", retryable: false } });
      if (result.ok) return;
      expect(result.error.message).not.toContain(unknownProfileId);
    });
  });
}
