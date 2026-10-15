import {
  submissionId,
  type Product,
  type SubmissionEvent,
  type User,
  type Workspace,
} from "@launchpilot/domain";
import { aListing } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import {
  AddToLaunch,
  ApproveContentItem,
  ApproveLaunchKit,
  ApproveBrief,
  CreateProduct,
  GenerateBrief,
  GenerateLaunchKit,
  GetLaunchOverview,
  ListDirectories,
  ReviseLaunchKit,
  UpdateSubmission,
} from "../src";
import { makeWorld, signedUp, type World } from "./world";

interface Setup {
  world: World;
  workspace: Workspace;
  user: User;
  product: Product;
}

const DAY = 24 * 60 * 60 * 1000;

const setUp = async ({ approveBrief = true } = {}): Promise<Setup> => {
  const world = makeWorld();
  const { workspace, user } = await signedUp(world);
  const created = await new CreateProduct(world).execute({
    workspace,
    name: "Acme Analytics",
    url: "https://acme.dev",
  });
  if (!created.ok) throw new Error(created.error.message);
  const product = created.value;
  world.crawler.addSite(product.url, [
    { url: product.url, title: "Acme", text: "Free 14-day trial.\nGDPR compliant." },
  ]);
  await new GenerateBrief(world).execute({ workspace, productId: product.id });
  if (approveBrief) {
    await new ApproveBrief(world).execute({
      workspace,
      productId: product.id,
      actor: { kind: "founder", userId: user.id },
    });
  }
  return { world, workspace, user, product };
};

const founder = ({ user }: Setup) => ({ kind: "founder" as const, userId: user.id });

const generate = async (s: Setup) => {
  const result = await new GenerateLaunchKit(s.world).execute({
    workspace: s.workspace,
    productId: s.product.id,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const approveKit = async (s: Setup) => {
  const result = await new ApproveLaunchKit(s.world).execute({
    workspace: s.workspace,
    productId: s.product.id,
    actor: founder(s),
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const add = async (s: Setup, slug: string) => {
  const result = await new AddToLaunch(s.world).execute({
    workspace: s.workspace,
    productId: s.product.id,
    directorySlug: slug,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const update = (s: Setup, id: string, event: SubmissionEvent, workspace = s.workspace) =>
  new UpdateSubmission(s.world).execute({ workspace, submissionId: submissionId(id), event });

const overview = async (s: Setup) => {
  const result = await new GetLaunchOverview(s.world).execute({
    workspace: s.workspace,
    productId: s.product.id,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("GenerateLaunchKit", () => {
  it("drafts the kit from the approved brief and puts each community post in review", async () => {
    const s = await setUp();
    const { kit, community } = await generate(s);
    expect(kit).toMatchObject({ productId: s.product.id, status: "draft", version: 1 });
    expect(kit.listing.name).toBe("Acme Analytics");
    expect(community.map((item) => [item.channel, item.status])).toEqual([
      ["hackernews", "in_review"],
      ["reddit", "in_review"],
      ["indiehackers", "in_review"],
    ]);
    expect(community[0]?.createdBy).toEqual({ kind: "agent", agent: "launch" });
    expect(s.world.launchWriter.requests[0]?.product).toEqual({
      name: "Acme Analytics",
      url: "https://acme.dev/",
    });
    const tasks = await s.world.tasks.listByCampaign(
      (await s.world.campaigns.listByProduct(s.product.id))[0]?.id ?? ("" as never),
    );
    expect(tasks.map((t) => t.kind)).toEqual(Array(3).fill("launch_submission"));
  });

  it("regenerates as a new kit version and archives the old community drafts", async () => {
    const s = await setUp();
    const first = await generate(s);
    const second = await generate(s);
    expect(second.kit).toMatchObject({ id: first.kit.id, version: 2, status: "draft" });
    for (const item of first.community) {
      expect((await s.world.contentItems.findById(item.id))?.status).toBe("archived");
    }
  });

  it("refuses before the brief is approved", async () => {
    const s = await setUp({ approveBrief: false });
    const result = await new GenerateLaunchKit(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
    });
    expect(result.ok ? undefined : result.error.code).toBe("brief_not_approved");
  });

  it("needs room for its 3 community drafts in the monthly allowance", async () => {
    const s = await setUp();
    // Free plan: 10 a month. Three kits use 9, so a fourth does not fit.
    await generate(s);
    await generate(s);
    await generate(s);
    const result = await new GenerateLaunchKit(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
    });
    expect(result.ok ? undefined : result.error.code).toBe("plan_limit_reached");
  });

  it("reports a writer failure and saves nothing", async () => {
    const s = await setUp();
    s.world.launchWriter.failNext({ code: "unavailable", message: "Busy", retryable: true });
    const result = await new GenerateLaunchKit(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
    });
    expect(result.ok ? undefined : result.error.code).toBe("unavailable");
    expect(await s.world.launchKits.findLatestForProduct(s.product.id)).toBeUndefined();
  });

  it("does not generate for another workspace's product", async () => {
    const s = await setUp();
    const { workspace: other } = await signedUp(s.world, "other@acme.dev");
    const result = await new GenerateLaunchKit(s.world).execute({
      workspace: other,
      productId: s.product.id,
    });
    expect(result.ok ? undefined : result.error.code).toBe("product_not_found");
  });
});

describe("ReviseLaunchKit and ApproveLaunchKit", () => {
  it("lets the founder edit the kit, which then needs approval again", async () => {
    const s = await setUp();
    await generate(s);
    await approveKit(s);
    const revised = await new ReviseLaunchKit(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
      listing: aListing({ tagline: "Analytics, minus the noise" }),
    });
    expect(revised).toMatchObject({
      ok: true,
      value: { version: 2, status: "draft", listing: { tagline: "Analytics, minus the noise" } },
    });
  });

  it("refuses to edit or approve a kit that does not exist yet", async () => {
    const s = await setUp();
    const approved = await new ApproveLaunchKit(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
      actor: founder(s),
    });
    expect(approved.ok ? undefined : approved.error.code).toBe("launch_kit_not_found");
    const revised = await new ReviseLaunchKit(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
      listing: aListing(),
    });
    expect(revised.ok ? undefined : revised.error.code).toBe("launch_kit_not_found");
  });
});

describe("ListDirectories and AddToLaunch", () => {
  it("lists the catalogue, filtered, marking the directories this product tracks", async () => {
    const s = await setUp();
    await add(s, "betalist");
    const result = await new ListDirectories(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
      filter: { pricing: "free" },
    });
    expect(result.ok && result.value.map((e) => [e.directory.slug, e.tracked])).toEqual([
      ["betalist", true],
      ["product-hunt", false],
      ["show-hn", false],
    ]);
  });

  it("adds a directory once, however often the founder clicks", async () => {
    const s = await setUp();
    const first = await add(s, "product-hunt");
    const again = await add(s, "product-hunt");
    expect(again.id).toBe(first.id);
    expect(await s.world.submissions.listByProduct(s.product.id)).toHaveLength(1);
  });

  it("refuses an unknown directory", async () => {
    const s = await setUp();
    const result = await new AddToLaunch(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
      directorySlug: "nope",
    });
    expect(result.ok ? undefined : result.error.code).toBe("directory_not_found");
  });
});

describe("UpdateSubmission", () => {
  it("tracks a submission from submitted to live once the kit is approved", async () => {
    const s = await setUp();
    await generate(s);
    const row = await add(s, "product-hunt");
    expect((await update(s, row.id, { type: "submit" })).ok).toBe(false);
    await approveKit(s);
    expect(await update(s, row.id, { type: "submit" })).toMatchObject({
      ok: true,
      value: { status: "submitted" },
    });
    expect(
      await update(s, row.id, {
        type: "markLive",
        listingUrl: "https://www.producthunt.com/posts/acme",
      }),
    ).toMatchObject({ ok: true, value: { status: "live" } });
    expect((await s.world.submissions.findById(row.id))?.status).toBe("live");
  });

  it("explains that the kit must be approved first", async () => {
    const s = await setUp();
    const row = await add(s, "product-hunt");
    const result = await update(s, row.id, { type: "submit" });
    expect(result.ok ? undefined : result.error.code).toBe("launch_kit_not_approved");
  });

  it("needs the community's draft post approved before submitting there", async () => {
    const s = await setUp();
    const { community } = await generate(s);
    await approveKit(s);
    const row = await add(s, "show-hn");
    const blocked = await update(s, row.id, { type: "submit" });
    expect(blocked.ok ? undefined : blocked.error.code).toBe("community_draft_not_approved");
    const showHn = community.find((item) => item.channel === "hackernews");
    if (!showHn) throw new Error("no Show HN draft");
    await new ApproveContentItem(s.world).execute({
      workspace: s.workspace,
      itemId: showHn.id,
      actor: founder(s),
    });
    expect((await update(s, row.id, { type: "submit" })).ok).toBe(true);
  });

  it("does not let another workspace update a submission", async () => {
    const s = await setUp();
    const row = await add(s, "product-hunt");
    const { workspace: other } = await signedUp(s.world, "other@acme.dev");
    const result = await update(s, row.id, { type: "skip" }, other);
    expect(result.ok ? undefined : result.error.code).toBe("submission_not_found");
  });
});

describe("GetLaunchOverview", () => {
  it("shows the kit, the community drafts and each tracker row fitted to its directory", async () => {
    const s = await setUp();
    await generate(s);
    await approveKit(s);
    await add(s, "betalist");
    await add(s, "product-hunt");
    const view = await overview(s);
    expect(view).toMatchObject({ briefApproved: true, kit: { status: "approved" } });
    expect(view.community.map((item) => item.channel)).toEqual([
      "hackernews",
      "reddit",
      "indiehackers",
    ]);
    expect(view.rows.map((r) => [r.directory.slug, r.warnings.length > 0])).toEqual([
      ["betalist", true],
      ["product-hunt", false],
    ]);
    expect(view.counts).toEqual({ planned: 2, submitted: 0, live: 0, rejected: 0, skipped: 0 });
  });

  it("flags a submission still waiting after two weeks", async () => {
    const s = await setUp();
    await generate(s);
    await approveKit(s);
    const row = await add(s, "product-hunt");
    await update(s, row.id, { type: "submit" });
    s.world.clock.advance(15 * DAY);
    expect((await overview(s)).rows[0]).toMatchObject({ followUp: true });
  });

  it("works before any kit exists", async () => {
    const s = await setUp();
    await add(s, "g2");
    const view = await overview(s);
    expect(view.kit).toBeNull();
    expect(view.rows[0]).toMatchObject({ fitted: null, warnings: [] });
  });
});
