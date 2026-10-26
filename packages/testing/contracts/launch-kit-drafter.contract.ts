import { communityChannels, validateListing } from "@nuvantre/domain";
import type { LaunchKitDrafter, LaunchKitRequest } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";
import { aBriefContent } from "../src/fixtures/entities";

export interface LaunchKitDrafterHarness {
  readonly drafter: LaunchKitDrafter;
  givenFailure(): void | Promise<void>;
}

const request: LaunchKitRequest = {
  brief: aBriefContent(),
  product: { name: "Acme Analytics", url: "https://acme.dev/" },
};

export function describeLaunchKitDrafterContract(
  name: string,
  make: () => LaunchKitDrafterHarness | Promise<LaunchKitDrafterHarness>,
): void {
  describe(`LaunchKitDrafter contract: ${name}`, () => {
    it("drafts a listing that fits every listing limit", async () => {
      const { drafter } = await make();
      const result = await drafter.draft(request);
      if (!result.ok) throw new Error(result.error.message);
      expect(validateListing(result.value.listing).ok).toBe(true);
    });

    it("drafts exactly one post for each community", async () => {
      const { drafter } = await make();
      const result = await drafter.draft(request);
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.community.map((post) => post.channel).sort()).toEqual(
        [...communityChannels].sort(),
      );
      for (const post of result.value.community) {
        expect(post.title.trim()).not.toBe("");
        expect(post.body.trim()).not.toBe("");
      }
    });

    it("cites only facts from the brief", async () => {
      const { drafter } = await make();
      const result = await drafter.draft(request);
      if (!result.ok) throw new Error(result.error.message);
      for (const fact of result.value.citedFacts) expect(request.brief.facts).toContain(fact);
    });

    it("reports a failure as a DraftError result instead of throwing", async () => {
      const harness = await make();
      await harness.givenFailure();
      expect((await harness.drafter.draft(request)).ok).toBe(false);
    });
  });
}
