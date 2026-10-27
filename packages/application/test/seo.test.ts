import type { BlogCredentials } from "@nuvantre/ports";
import {
  contentItemId,
  productId,
  taskId,
  transition,
  type Product,
  type User,
  type Workspace,
} from "@nuvantre/domain";
import { describe, expect, it } from "vitest";
import {
  ApproveBrief,
  ApproveContentItem,
  ConnectBlog,
  CreateProduct,
  DraftSeoArticle,
  GenerateBrief,
  GetContentItem,
  GetDashboard,
  GetSeoOverview,
  PlanSeoContent,
  PublishContentItem,
  ReviseContentItem,
  SetProductLocale,
} from "../src";
import { makeWorld, signedUp, type World } from "./world";

const BLOG = {
  platform: "wordpress" as const,
  siteUrl: "https://blog.acme.dev/",
  settings: { username: "admin" },
  secret: "abcd efgh ijkl",
};

const ideas = [
  { keyword: "cookieless analytics", monthlySearches: 900, difficulty: 14 },
  { keyword: "analytics", monthlySearches: 90_000, difficulty: 90 },
  { keyword: "privacy friendly analytics", monthlySearches: 1300, difficulty: 41 },
  { keyword: "gdpr analytics", monthlySearches: 300, difficulty: 20 },
  { keyword: "plausible alternative", monthlySearches: 200, difficulty: 25 },
  { keyword: "matomo alternative", monthlySearches: 150, difficulty: 30 },
];

interface Setup {
  world: World;
  workspace: Workspace;
  user: User;
  product: Product;
}

/** A founder with a product whose brief is drafted and, by default, approved. */
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
  world.keywords.setIdeas(ideas);
  world.blogVerifier.accept(BLOG, "Acme Blog");
  return { world, workspace, user, product };
};

const founder = ({ user }: Setup) => ({ kind: "founder" as const, userId: user.id });

const plan = async (s: Setup, seeds = ["privacy analytics"]) => {
  const result = await new PlanSeoContent(s.world).execute({
    workspace: s.workspace,
    productId: s.product.id,
    seeds,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const draft = async (s: Setup) => {
  const { tasks } = await plan(s);
  const [first] = tasks;
  if (!first) throw new Error("no task");
  const result = await new DraftSeoArticle(s.world).execute({
    workspace: s.workspace,
    taskId: first.id,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const approved = async (s: Setup) => {
  const item = await draft(s);
  const result = await new ApproveContentItem(s.world).execute({
    workspace: s.workspace,
    itemId: item.id,
    actor: founder(s),
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

/** An article the founder already published, which later articles may link to. */
const published = async (s: Setup, externalUrl = "https://blog.acme.dev/cookieless-analytics") => {
  const item = await approved(s);
  const live = transition(
    item,
    { type: "markPublished", externalUrl },
    { now: s.world.clock.now() },
  );
  if (!live.ok) throw new Error(live.error.message);
  await s.world.contentItems.save(live.value);
  return live.value;
};

const inPortuguese = async (s: Setup) => {
  const result = await new SetProductLocale(s.world).execute({
    workspace: s.workspace,
    productId: s.product.id,
    locale: "pt-BR",
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const connect = (s: Setup, credentials: BlogCredentials = BLOG) =>
  new ConnectBlog(s.world).execute({
    workspace: s.workspace,
    productId: s.product.id,
    ...credentials,
  });

describe("ConnectBlog", () => {
  it("verifies the blog and stores the connection with the password encrypted", async () => {
    const s = await setUp();
    const result = await connect(s);
    expect(result).toMatchObject({
      ok: true,
      value: { platform: "wordpress", siteName: "Acme Blog", siteUrl: "https://blog.acme.dev/" },
    });
    const stored = await s.world.connections.findByProductAndChannel(s.product.id, "blog");
    expect(stored?.encryptedSecret).not.toContain(BLOG.secret);
    expect(await s.world.cipher.decrypt(stored?.encryptedSecret ?? "")).toBe(BLOG.secret);
  });

  it("replaces the connection when the founder reconnects", async () => {
    const s = await setUp();
    await connect(s);
    const other = { ...BLOG, siteUrl: "https://news.acme.dev/" };
    s.world.blogVerifier.accept(other, "Acme News");
    await connect(s, other);
    const stored = await s.world.connections.findByProductAndChannel(s.product.id, "blog");
    expect(stored?.siteName).toBe("Acme News");
  });

  it("connects a Shopify store and keeps the blog the platform looked up", async () => {
    const s = await setUp();
    const shopify = {
      platform: "shopify" as const,
      siteUrl: "https://acme.myshopify.com/",
      settings: {},
      secret: "shpat_example",
    };
    s.world.blogVerifier.accept(shopify, "Acme Store", {
      blogId: "gid://shopify/Blog/1",
      blogHandle: "news",
    });
    expect(await connect(s, shopify)).toMatchObject({ ok: true, value: { platform: "shopify" } });
    const stored = await s.world.connections.findByProductAndChannel(s.product.id, "blog");
    expect(stored).toMatchObject({
      provider: "shopify",
      settings: { blogId: "gid://shopify/Blog/1", blogHandle: "news" },
    });
  });

  it("replaces a WordPress connection when the founder switches to Ghost", async () => {
    const s = await setUp();
    await connect(s);
    const ghost = {
      platform: "ghost" as const,
      siteUrl: "https://acme.ghost.io/",
      settings: {},
      secret: "6489a1:5f3c",
    };
    s.world.blogVerifier.accept(ghost, "Acme on Ghost");
    await connect(s, ghost);
    const stored = await s.world.connections.findByProductAndChannel(s.product.id, "blog");
    expect(stored).toMatchObject({ provider: "ghost", siteName: "Acme on Ghost", settings: {} });
  });

  it("stores nothing when WordPress rejects the password", async () => {
    const s = await setUp();
    const result = await connect(s, { ...BLOG, secret: "wrong" });
    expect(result.ok ? undefined : result.error.code).toBe("invalid_credentials");
    expect(await s.world.connections.findByProductAndChannel(s.product.id, "blog")).toBeUndefined();
  });

  it("does not connect a blog to another workspace's product", async () => {
    const s = await setUp();
    const { workspace: other } = await signedUp(s.world, "other@acme.dev");
    const result = await new ConnectBlog(s.world).execute({
      workspace: other,
      productId: s.product.id,
      ...BLOG,
    });
    expect(result.ok ? undefined : result.error.code).toBe("product_not_found");
  });
});

describe("PlanSeoContent", () => {
  it("turns the best keyword opportunities into a campaign of SEO article tasks", async () => {
    const s = await setUp();
    const { campaign, tasks } = await plan(s);
    expect(campaign).toMatchObject({ productId: s.product.id, status: "active" });
    expect(tasks.map((t) => t.seo?.keyword)).toEqual([
      "cookieless analytics",
      "privacy friendly analytics",
      "gdpr analytics",
      "plausible alternative",
    ]);
    expect(tasks[0]).toMatchObject({
      kind: "seo_article",
      title: "Article: cookieless analytics",
      status: "todo",
      seo: { monthlySearches: 900, difficulty: 14 },
    });
    expect(await s.world.tasks.listByCampaign(campaign.id)).toHaveLength(4);
  });

  it("researches keywords in the product's language and market", async () => {
    const s = await setUp();
    await inPortuguese(s);
    await plan(s);
    expect(s.world.keywords.queries[0]?.locale).toEqual({ language: "pt", market: "BR" });
  });

  it("plans one article per topic, without search figures, in a market with no keyword data", async () => {
    const s = await setUp();
    s.world.keywords.failNext({
      code: "unsupported_market",
      message: "No keyword data for Icelandic (Iceland)",
      retryable: false,
    });
    const result = await new PlanSeoContent(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
      seeds: ["vefgreining án vafrakaka", " ", "persónuvernd"],
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.searchData).toBe("unavailable");
    expect(result.value.tasks.map((t) => [t.title, t.seo])).toEqual([
      ["Article: vefgreining án vafrakaka", null],
      ["Article: persónuvernd", null],
    ]);
  });

  it("needs an approved brief, so articles only ever state approved facts", async () => {
    const s = await setUp({ approveBrief: false });
    const result = await new PlanSeoContent(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
      seeds: ["x"],
    });
    expect(result.ok ? undefined : result.error.code).toBe("brief_not_approved");
  });

  it("explains when no keyword is a realistic opportunity", async () => {
    const s = await setUp();
    s.world.keywords.setIdeas([{ keyword: "analytics", monthlySearches: 90_000, difficulty: 90 }]);
    const result = await new PlanSeoContent(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
      seeds: ["analytics"],
    });
    expect(result.ok ? undefined : result.error.code).toBe("no_keyword_opportunities");
  });

  it("passes a keyword provider failure through", async () => {
    const s = await setUp();
    const error = { code: "quota_exceeded", message: "No balance", retryable: false } as const;
    s.world.keywords.failNext(error);
    const result = await new PlanSeoContent(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
      seeds: ["x"],
    });
    expect(result).toEqual({ ok: false, error });
  });

  it("hides another workspace's product", async () => {
    const s = await setUp();
    const { workspace: other } = await signedUp(s.world, "other@acme.dev");
    const result = await new PlanSeoContent(s.world).execute({
      workspace: other,
      productId: s.product.id,
      seeds: ["x"],
    });
    expect(result.ok ? undefined : result.error.code).toBe("product_not_found");
  });
});

describe("DraftSeoArticle", () => {
  it("has the writer draft the task's article from the approved brief and sends it for review", async () => {
    const s = await setUp();
    const item = await draft(s);
    expect(item).toMatchObject({
      productId: s.product.id,
      channel: "blog",
      status: "in_review",
      createdBy: { kind: "agent", agent: "seo" },
    });
    const [request] = s.world.writer.requests;
    expect(request).toMatchObject({
      channel: "blog",
      task: { kind: "seo_article", title: "Article: cookieless analytics" },
      keywords: ["cookieless analytics"],
    });
    const brief = await s.world.briefs.findLatestForProduct(s.product.id);
    expect(request?.brief).toEqual(brief?.content);
    expect((await s.world.tasks.findById(item.taskId))?.status).toBe("in_progress");
  });

  it("writes in the product's language, may link only to its published articles, and keeps the slug and excerpt", async () => {
    const s = await setUp();
    const earlier = await published(s);
    await inPortuguese(s);
    const item = await draft(s);
    const request = s.world.writer.requests.at(-1);
    expect(request?.locale).toEqual({ language: "pt", market: "BR" });
    expect(request?.internalLinks).toEqual([
      { title: earlier.title, url: "https://blog.acme.dev/cookieless-analytics" },
    ]);
    expect(item.seo).toEqual({
      slug: "article-cookieless-analytics",
      excerpt: "About Article: cookieless analytics.",
    });
  });

  it("stops at the plan's monthly content allowance", async () => {
    const s = await setUp();
    const { tasks } = await plan(s);
    const [task] = tasks;
    if (!task) throw new Error("no task");
    for (let i = 0; i < 10; i++) {
      const result = await new DraftSeoArticle(s.world).execute({
        workspace: s.workspace,
        taskId: task.id,
      });
      expect(result.ok).toBe(true);
    }
    const eleventh = await new DraftSeoArticle(s.world).execute({
      workspace: s.workspace,
      taskId: task.id,
    });
    expect(eleventh).toEqual({
      ok: false,
      error: {
        code: "plan_limit_reached",
        message: "The Free plan includes 10 content items a month. Upgrade to create more.",
      },
    });
  });

  it("passes a writer failure through and creates nothing", async () => {
    const s = await setUp();
    const { tasks } = await plan(s);
    const error = { code: "unavailable", message: "Busy", retryable: true } as const;
    s.world.writer.failNext(error);
    const result = await new DraftSeoArticle(s.world).execute({
      workspace: s.workspace,
      taskId: tasks[0]?.id ?? taskId("x"),
    });
    expect(result).toEqual({ ok: false, error });
    expect(await s.world.contentItems.listByProduct(s.product.id)).toEqual([]);
  });

  it("reports a task that does not exist or belongs to another workspace", async () => {
    const s = await setUp();
    const { tasks } = await plan(s);
    const { workspace: other } = await signedUp(s.world, "other@acme.dev");
    for (const [workspace, id] of [
      [s.workspace, taskId("missing")],
      [other, tasks[0]?.id ?? taskId("x")],
    ] as const) {
      const result = await new DraftSeoArticle(s.world).execute({ workspace, taskId: id });
      expect(result.ok ? undefined : result.error.code).toBe("task_not_found");
    }
  });

  it("needs the brief to still be approved", async () => {
    const s = await setUp();
    const { tasks } = await plan(s);
    const brief = await s.world.briefs.findLatestForProduct(s.product.id);
    if (!brief) throw new Error("no brief");
    await s.world.briefs.save({ ...brief, status: "draft", approval: null });
    const result = await new DraftSeoArticle(s.world).execute({
      workspace: s.workspace,
      taskId: tasks[0]?.id ?? taskId("x"),
    });
    expect(result.ok ? undefined : result.error.code).toBe("brief_not_approved");
  });
});

describe("ReviseContentItem and ApproveContentItem", () => {
  it("lets the founder approve an article in review", async () => {
    const s = await setUp();
    const item = await approved(s);
    expect(item).toMatchObject({ status: "approved", approval: { by: s.user.id } });
  });

  it("sends an edited article back to review, clearing any approval", async () => {
    const s = await setUp();
    const item = await approved(s);
    const result = await new ReviseContentItem(s.world).execute({
      workspace: s.workspace,
      itemId: item.id,
      title: "A better title",
      body: "A better body.",
    });
    expect(result).toMatchObject({
      ok: true,
      value: { status: "in_review", title: "A better title", version: 2, approval: null },
    });
  });

  it("lets the founder change the article's URL slug and excerpt", async () => {
    const s = await setUp();
    const item = await draft(s);
    const result = await new ReviseContentItem(s.world).execute({
      workspace: s.workspace,
      itemId: item.id,
      body: item.body,
      slug: "cookieless-analytics-guide",
      excerpt: "A short guide to analytics without cookies.",
    });
    expect(result.ok && result.value.seo).toEqual({
      slug: "cookieless-analytics-guide",
      excerpt: "A short guide to analytics without cookies.",
    });
  });

  it("never lets an agent approve", async () => {
    const s = await setUp();
    const item = await draft(s);
    const result = await new ApproveContentItem(s.world).execute({
      workspace: s.workspace,
      itemId: item.id,
      actor: { kind: "agent", agent: "seo" },
    });
    expect(result.ok ? undefined : result.error.code).toBe("approval_requires_founder");
  });

  it("rejects an invalid edit and hides other workspaces' items", async () => {
    const s = await setUp();
    const item = await draft(s);
    const blank = await new ReviseContentItem(s.world).execute({
      workspace: s.workspace,
      itemId: item.id,
      title: " ",
      body: "x",
    });
    expect(blank.ok ? undefined : blank.error.code).toBe("invalid_text");
    const { workspace: other } = await signedUp(s.world, "other@acme.dev");
    const hidden = await new ApproveContentItem(s.world).execute({
      workspace: other,
      itemId: item.id,
      actor: founder(s),
    });
    expect(hidden.ok ? undefined : hidden.error.code).toBe("content_not_found");
  });
});

describe("PublishContentItem", () => {
  it("publishes an approved article to the connected blog and completes its task", async () => {
    const s = await setUp();
    await connect(s);
    s.world.blogPublisher.connect(s.product.id);
    const item = await approved(s);
    const result = await new PublishContentItem(s.world).execute({
      workspace: s.workspace,
      itemId: item.id,
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        status: "published",
        publication: { externalUrl: `https://example.com/blog/${item.id}` },
      },
    });
    expect(s.world.blogPublisher.publisher.published.map((p) => p.id)).toEqual([item.id]);
    expect((await s.world.tasks.findById(item.taskId))?.status).toBe("done");
  });

  it("refuses an article the founder has not approved", async () => {
    const s = await setUp();
    s.world.blogPublisher.connect(s.product.id);
    const item = await draft(s);
    const result = await new PublishContentItem(s.world).execute({
      workspace: s.workspace,
      itemId: item.id,
    });
    expect(result.ok ? undefined : result.error.code).toBe("not_publishable");
    expect(s.world.blogPublisher.publisher.published).toEqual([]);
  });

  it("asks to connect the blog first", async () => {
    const s = await setUp();
    const item = await approved(s);
    const result = await new PublishContentItem(s.world).execute({
      workspace: s.workspace,
      itemId: item.id,
    });
    expect(result.ok ? undefined : result.error.code).toBe("not_connected");
  });

  it("keeps the article approved when publishing fails, so it can be retried", async () => {
    const s = await setUp();
    s.world.blogPublisher.connect(s.product.id);
    const item = await approved(s);
    s.world.blogPublisher.publisher.failNext({
      code: "unavailable",
      message: "Down",
      retryable: true,
    });
    const result = await new PublishContentItem(s.world).execute({
      workspace: s.workspace,
      itemId: item.id,
    });
    expect(result.ok ? undefined : result.error.code).toBe("unavailable");
    expect((await s.world.contentItems.findById(item.id))?.status).toBe("approved");
  });

  it("reports an item that does not exist", async () => {
    const s = await setUp();
    const result = await new PublishContentItem(s.world).execute({
      workspace: s.workspace,
      itemId: contentItemId("missing"),
    });
    expect(result.ok ? undefined : result.error.code).toBe("content_not_found");
  });
});

describe("GetSeoOverview and GetContentItem", () => {
  it("shows the connection, the plan and each task's latest article", async () => {
    const s = await setUp();
    await connect(s);
    const item = await draft(s);
    const result = await new GetSeoOverview(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({
      product: { id: s.product.id },
      briefApproved: true,
      connection: {
        platform: "wordpress",
        siteName: "Acme Blog",
        siteUrl: "https://blog.acme.dev/",
      },
    });
    expect(result.value.connection).not.toHaveProperty("encryptedSecret");
    const [campaign] = result.value.campaigns;
    expect(campaign?.tasks[0]).toMatchObject({ task: { id: item.taskId }, item: { id: item.id } });
    expect(campaign?.tasks[1]?.item).toBeUndefined();
  });

  it("lists planned articles best opportunity first, whatever order storage returns", async () => {
    const s = await setUp();
    await plan(s);
    const tasks = s.world.tasks;
    const reversed = {
      ...s.world,
      tasks: {
        findById: tasks.findById.bind(tasks),
        save: tasks.save.bind(tasks),
        listByCampaign: async (id: Parameters<typeof tasks.listByCampaign>[0]) =>
          [...(await tasks.listByCampaign(id))].reverse(),
      },
    };
    const result = await new GetSeoOverview(reversed).execute({
      workspace: s.workspace,
      productId: s.product.id,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.campaigns[0]?.tasks.map(({ task }) => task.seo?.keyword)).toEqual([
      "cookieless analytics",
      "privacy friendly analytics",
      "gdpr analytics",
      "plausible alternative",
    ]);
  });

  it("reports an unapproved brief and no connection", async () => {
    const s = await setUp({ approveBrief: false });
    const result = await new GetSeoOverview(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
    });
    expect(result).toMatchObject({
      ok: true,
      value: { briefApproved: false, connection: null, campaigns: [] },
    });
  });

  it("returns an article with its task and product, for its own workspace only", async () => {
    const s = await setUp();
    const item = await draft(s);
    const result = await new GetContentItem(s.world).execute({
      workspace: s.workspace,
      itemId: item.id,
    });
    expect(result).toMatchObject({
      ok: true,
      value: { item: { id: item.id }, task: { id: item.taskId }, product: { id: s.product.id } },
    });
    const { workspace: other } = await signedUp(s.world, "other@acme.dev");
    const hidden = await new GetContentItem(s.world).execute({ workspace: other, itemId: item.id });
    expect(hidden.ok ? undefined : hidden.error.code).toBe("content_not_found");
  });

  it("hides another workspace's product overview", async () => {
    const s = await setUp();
    const result = await new GetSeoOverview(s.world).execute({
      workspace: s.workspace,
      productId: productId("missing"),
    });
    expect(result.ok ? undefined : result.error.code).toBe("product_not_found");
  });
});

describe("GetDashboard content usage", () => {
  it("counts the content created this month against the plan", async () => {
    const s = await setUp();
    await draft(s);
    const dashboard = await new GetDashboard(s.world).execute(s.workspace);
    expect(dashboard.usage).toEqual({ products: 1, contentItemsThisMonth: 1 });
  });
});

describe("SetProductLocale", () => {
  it("sets the language and market the product writes for", async () => {
    const s = await setUp();
    expect((await inPortuguese(s)).locale).toEqual({ language: "pt", market: "BR" });
    expect((await s.world.products.findById(s.product.id))?.locale).toEqual({
      language: "pt",
      market: "BR",
    });
  });

  it("refuses a locale it cannot read and hides other workspaces' products", async () => {
    const s = await setUp();
    const invalid = await new SetProductLocale(s.world).execute({
      workspace: s.workspace,
      productId: s.product.id,
      locale: "klingon",
    });
    expect(invalid.ok ? undefined : invalid.error.code).toBe("invalid_locale");
    const { workspace: other } = await signedUp(s.world, "other@acme.dev");
    const hidden = await new SetProductLocale(s.world).execute({
      workspace: other,
      productId: s.product.id,
      locale: "pt-BR",
    });
    expect(hidden.ok ? undefined : hidden.error.code).toBe("product_not_found");
  });
});
