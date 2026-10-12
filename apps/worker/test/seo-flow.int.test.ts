import {
  createDatabase,
  createPostgresRepositories,
  RandomTokenGenerator,
  ScryptPasswordHasher,
  SystemClock,
  UuidIdGenerator,
} from "@launchpilot/adapters";
import { ExtractiveBriefDrafter, TemplateArticleWriter } from "@launchpilot/agents";
import {
  ApproveBrief,
  ApproveContentItem,
  CreateProduct,
  DraftSeoArticle,
  GenerateBrief,
  GetSeoOverview,
  PlanSeoContent,
  PublishContentItem,
  PublisherRegistry,
  SignUp,
} from "@launchpilot/application";
import { FakeKeywordProvider, FakePublisherProvider, FakeSiteCrawler } from "@launchpilot/testing";
import { afterAll, describe, expect, inject, it } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

const db = createDatabase(inject("databaseUrl"));
afterAll(async () => {
  await db.destroy();
});

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }) => {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("SEO flow on Postgres", () => {
  it("plans, drafts, approves and publishes an article that survives a reload", async () => {
    const clock = new SystemClock();
    const blogPublisher = new FakePublisherProvider("blog", clock);
    const repositories = createPostgresRepositories(db);
    const deps = {
      ...repositories,
      connections: repositories.channelConnections,
      ids: new UuidIdGenerator(),
      clock,
      hasher: new ScryptPasswordHasher(),
      tokens: new RandomTokenGenerator(),
      crawler: new FakeSiteCrawler(),
      drafter: new ExtractiveBriefDrafter(),
      keywords: new FakeKeywordProvider(),
      writer: new TemplateArticleWriter(),
      publishers: new PublisherRegistry([blogPublisher]),
    };

    const { workspace, user } = unwrap(
      await new SignUp(deps).execute({
        email: `seo-${deps.ids.next()}@acme.dev`,
        password: "correct horse battery",
      }),
    );
    const product = unwrap(
      await new CreateProduct(deps).execute({ workspace, name: "Acme", url: "https://acme.dev" }),
    );
    deps.crawler.addSite(product.url, [
      {
        url: product.url,
        title: "Acme",
        text: "Analytics for SaaS founders.\nStart a free 14-day trial.",
      },
    ]);
    const founder = { kind: "founder" as const, userId: user.id };
    unwrap(await new GenerateBrief(deps).execute({ workspace, productId: product.id }));
    unwrap(
      await new ApproveBrief(deps).execute({ workspace, productId: product.id, actor: founder }),
    );

    deps.keywords.setIdeas([
      { keyword: "cookieless analytics", monthlySearches: 900, difficulty: 14 },
      { keyword: "gdpr analytics", monthlySearches: 300, difficulty: 20 },
    ]);
    const { tasks } = unwrap(
      await new PlanSeoContent(deps).execute({ workspace, productId: product.id, seeds: ["x"] }),
    );
    const [first] = tasks;
    if (!first) throw new Error("no planned task");
    const item = unwrap(await new DraftSeoArticle(deps).execute({ workspace, taskId: first.id }));
    unwrap(
      await new ApproveContentItem(deps).execute({ workspace, itemId: item.id, actor: founder }),
    );
    blogPublisher.connect(product.id);
    const published = unwrap(
      await new PublishContentItem(deps).execute({ workspace, itemId: item.id }),
    );
    expect(published.status).toBe("published");

    const overview = unwrap(
      await new GetSeoOverview({ ...deps, ...createPostgresRepositories(db) }).execute({
        workspace,
        productId: product.id,
      }),
    );
    const [plan] = overview.campaigns;
    expect(plan?.tasks.map(({ task }) => [task.seo?.keyword, task.status])).toEqual([
      ["cookieless analytics", "done"],
      ["gdpr analytics", "todo"],
    ]);
    expect(plan?.tasks[0]?.item).toMatchObject({
      id: item.id,
      status: "published",
      publication: { externalUrl: `https://example.com/blog/${item.id}` },
    });
  });
});
