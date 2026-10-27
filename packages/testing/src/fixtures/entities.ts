import {
  approveBrief,
  createBrief,
  createCampaign,
  createBlogConnection,
  createContentItem,
  createProduct,
  createLaunchKit,
  createSubmission,
  parseDirectory,
  createSocialProfile,
  createTask,
  createWorkspace,
  toPublishable,
  transition,
  type Actor,
  type BlogPlatform,
  type Brief,
  type BriefContent,
  type BriefId,
  type BriefStatus,
  type Campaign,
  type CampaignId,
  type Channel,
  type ChannelConnection,
  type ChannelConnectionId,
  type ContentItem,
  type ContentItemEvent,
  type ContentItemId,
  type ContentItemStatus,
  type Product,
  type ProductId,
  type PublishableContentItem,
  type Result,
  type Directory,
  type DirectoryInput,
  type LaunchKit,
  type Listing,
  type Submission,
  type SocialProfile,
  type SocialProfileId,
  type Task,
  type TaskId,
  type TaskKind,
  type Workspace,
  type WorkspaceId,
  briefId,
  campaignId,
  channelConnectionId,
  contentItemId,
  productId,
  launchKitId,
  socialProfileId,
  submissionId,
  taskId,
  userId,
  workspaceId,
} from "@nuvantre/domain";

/** Fixed reference time so fixtures are deterministic. */
export const fixtureNow = new Date("2026-01-05T09:00:00.000Z");
const later = new Date("2026-01-06T09:00:00.000Z");

/** Fixtures must always be valid; an invalid one is a bug in the test, so throw. */
export const unwrap = <T>(result: Result<T, { message: string }>): T => {
  if (!result.ok) throw new Error(`Invalid fixture: ${result.error.message}`);
  return result.value;
};

export const aFounder = (id = "user_founder"): Actor => ({
  kind: "founder",
  userId: userId(id),
});

export const aWorkspace = (
  overrides: Partial<Pick<Workspace, "id" | "name" | "ownerId">> = {},
): Workspace =>
  unwrap(
    createWorkspace({
      id: overrides.id ?? workspaceId("ws_1"),
      ownerId: overrides.ownerId ?? userId("user_founder"),
      name: overrides.name ?? "Acme Labs",
      now: fixtureNow,
    }),
  );

export const aProduct = (
  overrides: Partial<{ id: ProductId; workspaceId: WorkspaceId; name: string; url: string }> = {},
): Product =>
  unwrap(
    createProduct({
      id: overrides.id ?? productId("prod_1"),
      workspaceId: overrides.workspaceId ?? workspaceId("ws_1"),
      name: overrides.name ?? "Acme Analytics",
      url: overrides.url ?? "https://acme.dev",
      now: fixtureNow,
    }),
  );

export const aBriefContent = (overrides: Partial<BriefContent> = {}): BriefContent => ({
  audience: "Solo SaaS founders",
  problem: "Marketing takes time away from building",
  solution: "Privacy-friendly analytics with weekly insights",
  differentiators: ["No cookies", "Setup in two minutes"],
  tone: "Friendly and direct",
  facts: ["Free 14-day trial", "GDPR compliant", "Integrates with Search Console"],
  ...overrides,
});

export const aBrief = (
  overrides: Partial<{
    id: BriefId;
    productId: ProductId;
    content: BriefContent;
    status: BriefStatus;
    updatedAt: Date;
  }> = {},
): Brief => {
  const now = overrides.updatedAt ?? fixtureNow;
  const draft = unwrap(
    createBrief({
      id: overrides.id ?? briefId("brief_1"),
      productId: overrides.productId ?? productId("prod_1"),
      content: overrides.content ?? aBriefContent(),
      now,
    }),
  );
  return overrides.status === "approved" ? unwrap(approveBrief(draft, aFounder(), { now })) : draft;
};

export const aCampaign = (
  overrides: Partial<{ id: CampaignId; productId: ProductId; name: string; goal: string }> = {},
): Campaign =>
  unwrap(
    createCampaign({
      id: overrides.id ?? campaignId("camp_1"),
      productId: overrides.productId ?? productId("prod_1"),
      name: overrides.name ?? "Week 2 growth loop",
      goal: overrides.goal ?? "Publish two SEO articles",
      weekStarting: fixtureNow,
    }),
  );

export const aTask = (
  overrides: Partial<{ id: TaskId; campaignId: CampaignId; kind: TaskKind; title: string }> = {},
): Task =>
  unwrap(
    createTask({
      id: overrides.id ?? taskId("task_1"),
      campaignId: overrides.campaignId ?? campaignId("camp_1"),
      kind: overrides.kind ?? "seo_article",
      title: overrides.title ?? "Write a guide to privacy-friendly analytics",
    }),
  );

const founder = aFounder();

/** Real transitions from a fresh draft to each status; fixtures never bypass the state machine. */
const pathTo: Readonly<Record<ContentItemStatus, readonly ContentItemEvent[]>> = {
  draft: [],
  in_review: [{ type: "submit" }],
  approved: [{ type: "submit" }, { type: "approve", actor: founder }],
  rejected: [{ type: "submit" }, { type: "reject", actor: founder, reason: "Off-brand" }],
  scheduled: [
    { type: "submit" },
    { type: "approve", actor: founder },
    { type: "schedule", publishAt: later },
  ],
  published: [
    { type: "submit" },
    { type: "approve", actor: founder },
    { type: "markPublished", externalUrl: "https://acme.dev/blog/launch" },
  ],
  failed: [
    { type: "submit" },
    { type: "approve", actor: founder },
    { type: "schedule", publishAt: later },
    { type: "markFailed", reason: "Platform timeout" },
  ],
  archived: [{ type: "archive" }],
};

export const aContentItem = (
  overrides: Partial<{
    id: ContentItemId;
    productId: ProductId;
    taskId: TaskId;
    channel: Channel;
    title: string;
    body: string;
    status: ContentItemStatus;
    createdAt: Date;
  }> = {},
): ContentItem => {
  const now = overrides.createdAt ?? fixtureNow;
  const draft = unwrap(
    createContentItem({
      id: overrides.id ?? contentItemId("item_1"),
      productId: overrides.productId ?? productId("prod_1"),
      taskId: overrides.taskId ?? taskId("task_1"),
      channel: overrides.channel ?? "blog",
      title: overrides.title ?? "Privacy-friendly analytics for SaaS",
      body: overrides.body ?? "Here is how to measure growth without cookies.",
      createdBy: { kind: "agent", agent: "seo" },
      now,
    }),
  );
  return pathTo[overrides.status ?? "draft"].reduce(
    (item, event) => unwrap(transition(item, event, { now })),
    draft,
  );
};

export const aPublishableItem = (
  channel: Channel = "blog",
  id = "item_publishable",
): PublishableContentItem =>
  unwrap(toPublishable(aContentItem({ id: contentItemId(id), channel, status: "approved" })));

export const aBlogConnection = (
  overrides: Partial<{
    id: ChannelConnectionId;
    productId: ProductId;
    siteUrl: string;
    platform: BlogPlatform;
    settings: Readonly<Record<string, string>>;
  }> = {},
): ChannelConnection =>
  unwrap(
    createBlogConnection({
      id: overrides.id ?? channelConnectionId("conn_1"),
      productId: overrides.productId ?? productId("prod_1"),
      siteUrl: overrides.siteUrl ?? "https://blog.acme.dev",
      platform: overrides.platform ?? "wordpress",
      siteName: "Acme Blog",
      settings: overrides.settings ?? { username: "admin" },
      encryptedSecret: "v1:fixture-ciphertext",
      now: fixtureNow,
    }),
  );

export const aSocialProfile = (
  overrides: Partial<{ id: SocialProfileId; productId: ProductId }> = {},
): SocialProfile =>
  unwrap(
    createSocialProfile({
      id: overrides.id ?? socialProfileId("sp_1"),
      productId: overrides.productId ?? productId("prod_1"),
      externalProfileId: "zp_fixture",
      now: fixtureNow,
    }),
  );

export const aListing = (overrides: Partial<Listing> = {}): Listing => ({
  name: "Acme Analytics",
  tagline: "Privacy-friendly analytics in one weekly email",
  shortDescription: "The five numbers that matter, every Monday, without cookies.",
  longDescription:
    "Acme Analytics sends solo SaaS founders a weekly email with the five numbers that matter.",
  features: ["No cookies", "Setup in two minutes", "Weekly insights email"],
  categories: ["Analytics", "SaaS"],
  makerComment: "Hi everyone! We built Acme because dashboards were eating our week.",
  ...overrides,
});

export const aDirectory = (overrides: Partial<DirectoryInput> = {}): Directory =>
  unwrap(
    parseDirectory({
      slug: "betalist",
      name: "BetaList",
      kind: "launch_platform",
      channel: "directory",
      homepageUrl: "https://betalist.com",
      submitUrl: "https://betalist.com/submit",
      pricing: "free",
      priceNote: null,
      topics: ["startups"],
      limits: { tagline: 60 },
      checkedAt: "2026-10-15",
      ...overrides,
    }),
  );

export const aLaunchKit = (
  overrides: Partial<{ id: string; productId: ProductId; listing: Listing }> = {},
): LaunchKit =>
  unwrap(
    createLaunchKit({
      id: launchKitId(overrides.id ?? "kit_1"),
      productId: overrides.productId ?? productId("prod_1"),
      listing: overrides.listing ?? aListing(),
      now: fixtureNow,
    }),
  );

export const aSubmission = (
  overrides: Partial<{ id: string; productId: ProductId; directorySlug: string }> = {},
): Submission =>
  createSubmission({
    id: submissionId(overrides.id ?? "sub_1"),
    productId: overrides.productId ?? productId("prod_1"),
    directorySlug: overrides.directorySlug ?? "betalist",
    now: fixtureNow,
  });
