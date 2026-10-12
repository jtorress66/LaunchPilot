import {
  contentItemId,
  createContentItem,
  productId,
  transition,
  type ContentItem,
  type ContentItemEvent,
  type Product,
  type User,
  type Workspace,
} from "@launchpilot/domain";
import { describe, expect, it } from "vitest";
import {
  ApproveBrief,
  ApproveContentItem,
  ConnectSocial,
  CreateProduct,
  DraftSocialWeek,
  GenerateBrief,
  GetInbox,
  GetSocialOverview,
  PublishDueContent,
  RefreshSocialLinks,
  ReviseContentItem,
  SchedulePost,
  UnschedulePost,
} from "../src";
import { makeWorld, signedUp, type World } from "./world";

interface Setup {
  world: World;
  workspace: Workspace;
  user: User;
  product: Product;
}

const HOUR = 60 * 60 * 1000;
const RETURN_URL = "https://app.launchpilot.test/app/products/p/social?linked=1";

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
  const brief = await new GenerateBrief(world).execute({ workspace, productId: product.id });
  if (!brief.ok) throw new Error(brief.error.message);
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

const connect = (s: Setup, channel: "x" | "linkedin" = "x") =>
  new ConnectSocial(s.world).execute({
    workspace: s.workspace,
    productId: s.product.id,
    channel,
    returnUrl: RETURN_URL,
  });

/** Connects the product and has the founder link the given channels on the provider's page. */
const linked = async (s: Setup, channels: readonly ("x" | "linkedin")[] = ["x", "linkedin"]) => {
  await connect(s);
  s.world.linker.link(
    "zp_fake_1",
    channels.map((channel) => ({ channel, accountId: `acc_${channel}` })),
  );
  for (const channel of channels) {
    (channel === "x" ? s.world.xPublisher : s.world.linkedinPublisher).connect(s.product.id);
  }
  const result = await new RefreshSocialLinks(s.world).execute({
    workspace: s.workspace,
    productId: s.product.id,
  });
  if (!result.ok) throw new Error(result.error.message);
};

const draftWeek = async (s: Setup) => {
  const result = await new DraftSocialWeek(s.world).execute({
    workspace: s.workspace,
    productId: s.product.id,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const approvedPost = async (s: Setup, channel: "x" | "linkedin" = "x") => {
  const { items } = await draftWeek(s);
  const post = items.find((i) => i.channel === channel);
  if (!post) throw new Error("no post");
  const result = await new ApproveContentItem(s.world).execute({
    workspace: s.workspace,
    itemId: post.id,
    actor: founder(s),
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const schedule = (s: Setup, item: ContentItem, publishAt: Date) =>
  new SchedulePost(s.world).execute({ workspace: s.workspace, itemId: item.id, publishAt });

const scheduledPost = async (s: Setup, channel: "x" | "linkedin" = "x") => {
  const post = await approvedPost(s, channel);
  const result = await schedule(s, post, new Date(s.world.clock.now().getTime() + HOUR));
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const publishDue = (s: Setup) => new PublishDueContent(s.world).execute();

const stored = async (s: Setup, item: ContentItem) => s.world.contentItems.findById(item.id);

describe("ConnectSocial", () => {
  it("creates a social profile for the product and returns the linking page for the channel", async () => {
    const s = await setUp();
    const result = await connect(s, "linkedin");
    expect(result).toEqual({
      ok: true,
      value: {
        url: `https://link.social.test/linkedin?profile=zp_fake_1&return=${encodeURIComponent(RETURN_URL)}`,
      },
    });
    const profile = await s.world.socialProfiles.findByProduct(s.product.id);
    expect(profile).toMatchObject({
      provider: "zernio",
      externalProfileId: "zp_fake_1",
      linkedAccounts: [],
    });
    expect(s.world.linker.created).toEqual(["Acme Analytics"]);
  });

  it("reuses the product's profile when the founder connects another channel", async () => {
    const s = await setUp();
    await connect(s, "x");
    const again = await connect(s, "linkedin");
    expect(again.ok && again.value.url).toContain("/linkedin?profile=zp_fake_1");
    expect(s.world.linker.created).toHaveLength(1);
  });

  it("stores nothing when the provider cannot create a profile", async () => {
    const s = await setUp();
    s.world.linker.failNext({ code: "unavailable", message: "Down", retryable: true });
    const result = await connect(s);
    expect(result.ok ? undefined : result.error.code).toBe("unavailable");
    expect(await s.world.socialProfiles.findByProduct(s.product.id)).toBeUndefined();
  });

  it("does not connect another workspace's product", async () => {
    const s = await setUp();
    const { workspace: other } = await signedUp(s.world, "other@acme.dev");
    const result = await new ConnectSocial(s.world).execute({
      workspace: other,
      productId: s.product.id,
      channel: "x",
      returnUrl: RETURN_URL,
    });
    expect(result.ok ? undefined : result.error.code).toBe("product_not_found");
  });
});

describe("RefreshSocialLinks", () => {
  it("stores which accounts the founder linked", async () => {
    const s = await setUp();
    await linked(s, ["linkedin", "x"]);
    const profile = await s.world.socialProfiles.findByProduct(s.product.id);
    expect(profile?.linkedAccounts).toEqual([
      { channel: "x", accountId: "acc_x" },
      { channel: "linkedin", accountId: "acc_linkedin" },
    ]);
  });

  it("asks the founder to connect first when there is no profile", async () => {
    const s = await setUp();
    const result = await new RefreshSocialLinks(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
    });
    expect(result.ok ? undefined : result.error.code).toBe("social_not_connected");
  });
});

describe("DraftSocialWeek", () => {
  it("plans a week of posts from the approved brief and puts each in review", async () => {
    const s = await setUp();
    const { campaign, items, stoppedAtLimit } = await draftWeek(s);
    expect(campaign).toMatchObject({ productId: s.product.id, status: "active" });
    expect(items.map((i) => i.channel)).toEqual(["x", "x", "x", "linkedin", "linkedin"]);
    expect(items.every((i) => i.status === "in_review")).toBe(true);
    expect(items[0]?.createdBy).toEqual({ kind: "agent", agent: "social" });
    expect(stoppedAtLimit).toBe(false);
    const tasks = await s.world.tasks.listByCampaign(campaign.id);
    expect(tasks.map((t) => [t.kind, t.status])).toEqual(
      Array.from({ length: 5 }, () => ["social_post", "in_progress"]),
    );
    expect(s.world.socialWriter.requests.map((r) => r.channel)).toEqual(
      items.map((i) => i.channel),
    );
  });

  it("promotes the latest published blog article, with its link", async () => {
    const s = await setUp();
    const [earlier] = (await draftWeek(s)).items;
    if (!earlier) throw new Error("no post");
    const article = createContentItem({
      id: contentItemId("item_article"),
      productId: s.product.id,
      taskId: earlier.taskId,
      channel: "blog",
      title: "Cookieless analytics guide",
      body: "Body",
      createdBy: { kind: "agent", agent: "seo" },
      now: s.world.clock.now(),
    });
    if (!article.ok) throw new Error(article.error.message);
    const events: ContentItemEvent[] = [
      { type: "submit" },
      { type: "approve", actor: founder(s) },
      { type: "markPublished", externalUrl: "https://blog.acme.dev/guide" },
    ];
    const published = events.reduce<ContentItem>((item, event) => {
      const next = transition(item, event, { now: s.world.clock.now() });
      if (!next.ok) throw new Error(next.error.message);
      return next.value;
    }, article.value);
    await s.world.contentItems.save(published);
    s.world.socialWriter.requests.length = 0;

    await draftWeek(s);
    const [firstX] = s.world.socialWriter.requests;
    expect(firstX).toMatchObject({
      channel: "x",
      task: { kind: "social_post", title: "New article: Cookieless analytics guide" },
      link: "https://blog.acme.dev/guide",
    });
  });

  it("stops cleanly at the plan's monthly allowance and reports it", async () => {
    const s = await setUp();
    // Free plan: 10 items a month. Two weeks use them all.
    await draftWeek(s);
    const second = await draftWeek(s);
    expect(second.items).toHaveLength(5);
    const third = await new DraftSocialWeek(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
    });
    expect(third.ok ? undefined : third.error.code).toBe("plan_limit_reached");
  });

  it("keeps what it drafted when the allowance runs out partway", async () => {
    const s = await setUp();
    await draftWeek(s);
    const { items } = await draftWeek(s);
    // Move two items to last month, leaving 2 of the Free plan's 10 for this month.
    for (const item of items.slice(0, 2)) {
      await s.world.contentItems.save({ ...item, createdAt: new Date("2026-04-15") });
    }
    const result = await draftWeek(s);
    expect(result.items.map((i) => i.channel)).toEqual(["x", "x"]);
    expect(result.stoppedAtLimit).toBe(true);
  });

  it("refuses to draft before the brief is approved", async () => {
    const s = await setUp({ approveBrief: false });
    const result = await new DraftSocialWeek(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
    });
    expect(result.ok ? undefined : result.error.code).toBe("brief_not_approved");
  });

  it("reports a writer failure when nothing could be drafted", async () => {
    const s = await setUp();
    s.world.socialWriter.failNext({ code: "unavailable", message: "Busy", retryable: true });
    const result = await new DraftSocialWeek(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
    });
    expect(result.ok ? undefined : result.error.code).toBe("unavailable");
  });
});

describe("revising a post", () => {
  it("keeps the post's title when only its text changes, and the X limit applies", async () => {
    const s = await setUp();
    const post = await approvedPost(s);
    const revise = (body: string) =>
      new ReviseContentItem(s.world).execute({ workspace: s.workspace, itemId: post.id, body });
    expect(await revise("Shorter and better.")).toMatchObject({
      ok: true,
      value: { title: post.title, body: "Shorter and better.", status: "in_review" },
    });
    const tooLong = await revise("a".repeat(281));
    expect(tooLong.ok ? undefined : tooLong.error.message).toBe(
      "Body must be at most 280 characters",
    );
  });
});

describe("SchedulePost and UnschedulePost", () => {
  it("schedules an approved post for a future time", async () => {
    const s = await setUp();
    const post = await approvedPost(s);
    const at = new Date(s.world.clock.now().getTime() + HOUR);
    expect(await schedule(s, post, at)).toMatchObject({
      ok: true,
      value: { status: "scheduled", publishAt: at },
    });
    expect((await stored(s, post))?.status).toBe("scheduled");
  });

  it("refuses a time in the past", async () => {
    const s = await setUp();
    const post = await approvedPost(s);
    const result = await schedule(s, post, new Date(s.world.clock.now().getTime() - HOUR));
    expect(result.ok ? undefined : result.error.code).toBe("publish_time_in_past");
  });

  it("refuses to schedule a post the founder has not approved", async () => {
    const s = await setUp();
    const { items } = await draftWeek(s);
    const [post] = items;
    if (!post) throw new Error("no post");
    const result = await schedule(s, post, new Date(s.world.clock.now().getTime() + HOUR));
    expect(result.ok).toBe(false);
    expect((await stored(s, post))?.status).toBe("in_review");
  });

  it("moves a scheduled post back to approved", async () => {
    const s = await setUp();
    const post = await scheduledPost(s);
    const result = await new UnschedulePost(s.world).execute({
      workspace: s.workspace,
      itemId: post.id,
    });
    expect(result).toMatchObject({ ok: true, value: { status: "approved", publishAt: null } });
  });

  it("does not schedule another workspace's post", async () => {
    const s = await setUp();
    const post = await approvedPost(s);
    const { workspace: other } = await signedUp(s.world, "other@acme.dev");
    const result = await new SchedulePost(s.world).execute({
      workspace: other,
      itemId: post.id,
      publishAt: new Date(s.world.clock.now().getTime() + HOUR),
    });
    expect(result.ok ? undefined : result.error.code).toBe("content_not_found");
  });
});

describe("PublishDueContent", () => {
  it("publishes scheduled posts whose time has come, earliest first, and leaves the rest", async () => {
    const s = await setUp();
    await linked(s);
    const { items } = await draftWeek(s);
    const [a, b, c] = items;
    if (!a || !b || !c) throw new Error("posts missing");
    const now = s.world.clock.now().getTime();
    for (const [item, offset] of [
      [a, 2 * HOUR],
      [b, HOUR],
      [c, 5 * HOUR],
    ] as const) {
      await new ApproveContentItem(s.world).execute({
        workspace: s.workspace,
        itemId: item.id,
        actor: founder(s),
      });
      await schedule(s, item, new Date(now + offset));
    }
    s.world.clock.advance(3 * HOUR);

    expect(await publishDue(s)).toEqual({ published: 2, retrying: 0, failed: 0 });
    expect(s.world.xPublisher.publisher.published.map((i) => i.id)).toEqual([b.id, a.id]);
    expect((await stored(s, a))?.status).toBe("published");
    expect((await stored(s, a))?.publication?.externalUrl).toBe(`https://example.com/x/${a.id}`);
    expect((await stored(s, c))?.status).toBe("scheduled");
    const task = await s.world.tasks.findById(a.taskId);
    expect(task?.status).toBe("done");
  });

  it("keeps a post scheduled after a temporary failure, then fails it after 3 attempts", async () => {
    const s = await setUp();
    await linked(s);
    const post = await scheduledPost(s);
    s.world.clock.advance(2 * HOUR);
    const outage = { code: "unavailable", message: "Ayrshare is down", retryable: true } as const;

    for (const attempt of [1, 2]) {
      s.world.xPublisher.publisher.failNext(outage);
      expect(await publishDue(s)).toEqual({ published: 0, retrying: 1, failed: 0 });
      expect(await stored(s, post)).toMatchObject({
        status: "scheduled",
        publishAttempts: attempt,
      });
    }
    s.world.xPublisher.publisher.failNext(outage);
    expect(await publishDue(s)).toEqual({ published: 0, retrying: 0, failed: 1 });
    expect(await stored(s, post)).toMatchObject({
      status: "failed",
      failure: { reason: "Ayrshare is down" },
    });
  });

  it("fails a post at once when the platform rejects it", async () => {
    const s = await setUp();
    await linked(s);
    const post = await scheduledPost(s);
    s.world.clock.advance(2 * HOUR);
    s.world.xPublisher.publisher.failNext({
      code: "rejected_by_platform",
      message: "X rejected the post: Duplicate content",
      retryable: false,
    });
    expect(await publishDue(s)).toEqual({ published: 0, retrying: 0, failed: 1 });
    expect((await stored(s, post))?.status).toBe("failed");
  });

  it("fails a post whose channel is no longer linked", async () => {
    const s = await setUp();
    const post = await scheduledPost(s);
    s.world.clock.advance(2 * HOUR);
    expect(await publishDue(s)).toEqual({ published: 0, retrying: 0, failed: 1 });
    expect((await stored(s, post))?.failure?.reason).toBe("Connect your x first");
  });

  it("never publishes a draft-only channel, even if one were stored as scheduled", async () => {
    const s = await setUp();
    const post = await scheduledPost(s);
    const sneaky = { ...post, id: contentItemId("item_reddit"), channel: "reddit" as const };
    await s.world.contentItems.save(sneaky);
    await s.world.contentItems.save({ ...post, status: "approved", publishAt: null });
    s.world.clock.advance(2 * HOUR);
    expect(await publishDue(s)).toEqual({ published: 0, retrying: 0, failed: 1 });
    expect(s.world.xPublisher.publisher.published).toEqual([]);
    expect((await s.world.contentItems.findById(sneaky.id))?.status).toBe("failed");
  });

  it("publishes at most one batch per run", async () => {
    const s = await setUp();
    await linked(s);
    const post = await scheduledPost(s);
    for (let i = 0; i < 25; i++) {
      await s.world.contentItems.save({ ...post, id: contentItemId(`item_batch_${String(i)}`) });
    }
    s.world.clock.advance(2 * HOUR);
    expect((await publishDue(s)).published).toBe(20);
    expect((await publishDue(s)).published).toBe(6);
  });
});

describe("GetInbox", () => {
  it("lists every item waiting for review across the workspace's products, oldest first", async () => {
    const s = await setUp();
    const { items } = await draftWeek(s);
    const inbox = await new GetInbox(s.world).execute({ workspace: s.workspace });
    expect(inbox.map((entry) => entry.item.id)).toEqual(items.map((i) => i.id));
    expect(inbox[0]?.product.name).toBe("Acme Analytics");
  });

  it("does not show another workspace's items", async () => {
    const s = await setUp();
    await draftWeek(s);
    const { workspace: other } = await signedUp(s.world, "other@acme.dev");
    expect(await new GetInbox(s.world).execute({ workspace: other })).toEqual([]);
  });
});

describe("GetSocialOverview", () => {
  it("shows the linked channels, this product's posts and a two-week calendar", async () => {
    const s = await setUp();
    await linked(s, ["x"]);
    const post = await scheduledPost(s);
    const result = await new GetSocialOverview(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({ briefApproved: true, linkedChannels: ["x"] });
    expect(result.value.posts).toHaveLength(5);
    expect(result.value.calendar.days).toHaveLength(14);
    expect(result.value.calendar.days[0]?.items.map((i) => i.id)).toEqual([post.id]);
  });

  it("reports a product that has not connected social accounts", async () => {
    const s = await setUp();
    const result = await new GetSocialOverview(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
    });
    expect(result.ok && result.value.linkedChannels).toBeNull();
  });

  it("hides another workspace's product", async () => {
    const s = await setUp();
    const { workspace: other } = await signedUp(s.world, "other@acme.dev");
    const result = await new GetSocialOverview(s.world).execute({
      workspace: other,
      productId: productId(s.product.id),
    });
    expect(result.ok ? undefined : result.error.code).toBe("product_not_found");
  });
});
