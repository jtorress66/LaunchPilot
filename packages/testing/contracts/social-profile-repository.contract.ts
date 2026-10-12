import { productId, socialProfileId, withLinkedChannels } from "@launchpilot/domain";
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

    it("stores the linked channels when the profile is saved again", async () => {
      const repo = await make();
      const profile = aSocialProfile();
      await repo.save(profile);
      const linked = withLinkedChannels(profile, ["x", "linkedin"]);
      await repo.save(linked);
      expect(await repo.findByProduct(productId("prod_1"))).toEqual(linked);
    });

    it("is not affected when callers mutate saved or returned objects", async () => {
      const repo = await make();
      const profile = aSocialProfile();
      const snapshot = structuredClone(profile);
      await repo.save(profile);
      Object.assign(profile, { refId: "changed" });
      const found = await repo.findByProduct(productId("prod_1"));
      expect(found).toEqual(snapshot);
      if (found !== undefined) Object.assign(found, { refId: "changed" });
      expect(await repo.findByProduct(productId("prod_1"))).toEqual(snapshot);
    });
  });
}
