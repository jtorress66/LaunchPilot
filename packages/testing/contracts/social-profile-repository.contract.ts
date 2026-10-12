import { productId, socialProfileId, withLinkedAccounts } from "@launchpilot/domain";
import type { SocialProfileRepository } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";
import { aSocialProfile } from "../src/fixtures/entities";

export function describeSocialProfileRepositoryContract(
  name: string,
  make: () => SocialProfileRepository | Promise<SocialProfileRepository>,
): void {
  describe(`SocialProfileRepository contract: ${name}`, () => {
    it("finds a product's profile", async () => {
      const repo = await make();
      const mine = aSocialProfile();
      await repo.save(mine);
      await repo.save(
        aSocialProfile({ id: socialProfileId("sp_2"), productId: productId("prod_2") }),
      );
      expect(await repo.findByProduct(productId("prod_1"))).toEqual(mine);
      expect(await repo.findByProduct(productId("prod_missing"))).toBeUndefined();
    });

    it("stores the linked accounts when the profile is saved again", async () => {
      const repo = await make();
      const profile = aSocialProfile();
      await repo.save(profile);
      const linked = withLinkedAccounts(profile, [
        { channel: "x", accountId: "acc_x" },
        { channel: "linkedin", accountId: "acc_li" },
      ]);
      await repo.save(linked);
      expect(await repo.findByProduct(productId("prod_1"))).toEqual(linked);
    });

    it("is not affected when callers mutate saved or returned objects", async () => {
      const repo = await make();
      const profile = aSocialProfile();
      const snapshot = structuredClone(profile);
      await repo.save(profile);
      Object.assign(profile, { externalProfileId: "changed" });
      const found = await repo.findByProduct(productId("prod_1"));
      expect(found).toEqual(snapshot);
      if (found !== undefined) Object.assign(found, { externalProfileId: "changed" });
      expect(await repo.findByProduct(productId("prod_1"))).toEqual(snapshot);
    });
  });
}
