import {
  approveLaunchKit,
  productId,
  transitionSubmission,
  type Directory,
} from "@nuvantre/domain";
import type { DirectoryCatalog, LaunchKitRepository, SubmissionRepository } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";
import {
  aDirectory,
  aLaunchKit,
  aListing,
  aFounder,
  aSubmission,
  fixtureNow,
} from "../src/fixtures/entities";

type Make<R> = () => R | Promise<R>;

export function describeDirectoryCatalogContract(
  name: string,
  make: (directories: readonly Directory[]) => DirectoryCatalog | Promise<DirectoryCatalog>,
): void {
  describe(`DirectoryCatalog contract: ${name}`, () => {
    const directories = [
      aDirectory(),
      aDirectory({ slug: "product-hunt", name: "Product Hunt", channel: "producthunt" }),
      aDirectory({
        slug: "show-hn",
        name: "Show HN",
        kind: "community",
        channel: "hackernews",
        limits: {},
      }),
    ];

    it("lists every directory it holds", async () => {
      const catalog = await make(directories);
      const listed = await catalog.list();
      expect([...listed].sort((a, b) => a.slug.localeCompare(b.slug))).toEqual(
        [...directories].sort((a, b) => a.slug.localeCompare(b.slug)),
      );
    });

    it("finds a directory by slug, and nothing for an unknown one", async () => {
      const catalog = await make(directories);
      expect(await catalog.findBySlug("show-hn")).toEqual(directories[2]);
      expect(await catalog.findBySlug("missing")).toBeUndefined();
    });
  });
}

export function describeLaunchKitRepositoryContract(
  name: string,
  make: Make<LaunchKitRepository>,
): void {
  describe(`LaunchKitRepository contract: ${name}`, () => {
    it("finds a product's kit after it is saved", async () => {
      const repo = await make();
      const kit = aLaunchKit();
      await repo.save(kit);
      expect(await repo.findLatestForProduct(productId("prod_1"))).toEqual(kit);
      expect(await repo.findLatestForProduct(productId("prod_2"))).toBeUndefined();
    });

    it("keeps the latest revision when the kit is edited and approved", async () => {
      const repo = await make();
      const kit = aLaunchKit();
      await repo.save(kit);
      const approved = approveLaunchKit(kit, aFounder(), { now: fixtureNow });
      if (!approved.ok) throw new Error(approved.error.message);
      await repo.save(approved.value);
      expect(await repo.findLatestForProduct(productId("prod_1"))).toEqual(approved.value);
    });

    it("is not affected when callers mutate saved or returned objects", async () => {
      const repo = await make();
      const kit = aLaunchKit();
      const snapshot = structuredClone(kit);
      await repo.save(kit);
      Object.assign(kit, { listing: aListing({ tagline: "Changed" }) });
      const found = await repo.findLatestForProduct(productId("prod_1"));
      expect(found).toEqual(snapshot);
    });
  });
}

export function describeSubmissionRepositoryContract(
  name: string,
  make: Make<SubmissionRepository>,
): void {
  describe(`SubmissionRepository contract: ${name}`, () => {
    it("finds a submission by id and by product and directory", async () => {
      const repo = await make();
      const submission = aSubmission();
      await repo.save(submission);
      expect(await repo.findById(submission.id)).toEqual(submission);
      expect(await repo.findByProductAndDirectory(productId("prod_1"), "betalist")).toEqual(
        submission,
      );
      expect(await repo.findByProductAndDirectory(productId("prod_1"), "g2")).toBeUndefined();
    });

    it("lists a product's submissions by directory, and no other product's", async () => {
      const repo = await make();
      const mine = [
        aSubmission({ id: "sub_2", directorySlug: "product-hunt" }),
        aSubmission({ id: "sub_1", directorySlug: "betalist" }),
      ];
      const other = aSubmission({ id: "sub_3", productId: productId("prod_2") });
      for (const s of [...mine, other]) await repo.save(s);
      expect((await repo.listByProduct(productId("prod_1"))).map((s) => s.id)).toEqual([
        "sub_1",
        "sub_2",
      ]);
    });

    it("stores every status change", async () => {
      const repo = await make();
      const submission = aSubmission();
      await repo.save(submission);
      const submitted = transitionSubmission(
        submission,
        { type: "submit" },
        { now: fixtureNow, kitApproved: true },
      );
      if (!submitted.ok) throw new Error(submitted.error.message);
      const live = transitionSubmission(
        submitted.value,
        { type: "markLive", listingUrl: "https://betalist.com/startups/acme" },
        { now: fixtureNow, kitApproved: true },
      );
      if (!live.ok) throw new Error(live.error.message);
      await repo.save(live.value);
      expect(await repo.findById(submission.id)).toEqual(live.value);
    });
  });
}
