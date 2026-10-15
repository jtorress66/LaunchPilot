import { productId } from "@launchpilot/domain";
import { aDirectory, aSubmission } from "@launchpilot/testing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  PostgresDirectoryCatalog,
  PostgresSubmissionRepository,
  loadSeedDirectories,
  syncDirectories,
} from "../../src/postgres";
import { connect, resetWith } from "./test-db";

const db = connect();
afterAll(async () => {
  await db.destroy();
});
beforeEach(async () => {
  await resetWith(db, "products");
});

const catalog = () => new PostgresDirectoryCatalog(db);
const slugs = async () => (await catalog().list()).map((d) => d.slug).sort();

describe("syncDirectories", () => {
  it("adds every directory and reports what changed; running again changes nothing", async () => {
    const list = [
      aDirectory(),
      aDirectory({ slug: "saashub", name: "SaaSHub", kind: "directory" }),
    ];
    expect(await syncDirectories(db, list)).toEqual({ upserted: 2, removed: 0, kept: 0 });
    expect(await syncDirectories(db, list)).toEqual({ upserted: 2, removed: 0, kept: 0 });
    expect(await slugs()).toEqual(["betalist", "saashub"]);
  });

  it("updates an entry that changed", async () => {
    await syncDirectories(db, [aDirectory()]);
    await syncDirectories(db, [aDirectory({ pricing: "paid", priceNote: "Now paid only." })]);
    expect(await catalog().findBySlug("betalist")).toMatchObject({
      pricing: "paid",
      priceNote: "Now paid only.",
    });
  });

  it("removes dropped entries, but keeps one a product is tracking", async () => {
    await syncDirectories(db, [
      aDirectory(),
      aDirectory({ slug: "saashub", name: "SaaSHub", kind: "directory" }),
      aDirectory({ slug: "gone", name: "Gone", kind: "directory" }),
    ]);
    await new PostgresSubmissionRepository(db).save(
      aSubmission({ productId: productId("prod_1"), directorySlug: "saashub" }),
    );
    expect(await syncDirectories(db, [aDirectory()])).toEqual({
      upserted: 1,
      removed: 1,
      kept: 1,
    });
    expect(await slugs()).toEqual(["betalist", "saashub"]);
  });
});

describe("the curated seed", () => {
  it("is valid, with unique slugs, and loads into Postgres", async () => {
    const seed = loadSeedDirectories();
    if (!seed.ok) throw new Error(seed.error);
    expect(seed.value.length).toBeGreaterThanOrEqual(20);
    expect(new Set(seed.value.map((d) => d.slug)).size).toBe(seed.value.length);
    await syncDirectories(db, seed.value);
    expect((await catalog().list()).length).toBe(seed.value.length);
  });

  it("includes Product Hunt with its 60-character tagline, and Show HN as a community", () => {
    const seed = loadSeedDirectories();
    if (!seed.ok) throw new Error(seed.error);
    expect(seed.value.find((d) => d.slug === "product-hunt")).toMatchObject({
      channel: "producthunt",
      kind: "launch_platform",
      limits: { tagline: 60 },
    });
    expect(seed.value.find((d) => d.channel === "hackernews")).toMatchObject({
      kind: "community",
    });
  });
});
