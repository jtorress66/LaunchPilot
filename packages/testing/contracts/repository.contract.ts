import type {
  BriefRepository,
  CampaignRepository,
  ChannelConnectionRepository,
  ContentItemRepository,
  ProductRepository,
  Repository,
  TaskRepository,
  WorkspaceRepository,
} from "@nuvantre/ports";
import {
  briefId,
  campaignId,
  channelConnectionId,
  contentItemId,
  enableAutopilot,
  productId,
  reviewOf,
  taskId,
  userId,
  withAgentReview,
  workspaceId,
} from "@nuvantre/domain";
import { describe, expect, it } from "vitest";
import {
  aBlogConnection,
  aBrief,
  aCampaign,
  aContentItem,
  aProduct,
  aTask,
  aWorkspace,
} from "../src/fixtures/entities";

type Make<R> = () => R | Promise<R>;

interface GenericOptions<Id, T> {
  readonly make: Make<Repository<Id, T>>;
  /** Distinct, valid entities for different seeds. */
  readonly sample: (seed: number) => T & { readonly id: Id };
  /** A changed copy with the same id. */
  readonly modify: (entity: T) => T;
  readonly unknownId: Id;
}

/** Behaviour every repository shares, whatever it stores. */
export function describeRepositoryContract<Id, T extends object>(
  name: string,
  options: GenericOptions<Id, T>,
): void {
  describe(`Repository contract: ${name}`, () => {
    it("finds an entity after it is saved", async () => {
      const repo = await options.make();
      const entity = options.sample(1);
      await repo.save(entity);
      expect(await repo.findById(entity.id)).toEqual(entity);
    });

    it("returns undefined for an unknown id", async () => {
      const repo = await options.make();
      await repo.save(options.sample(1));
      expect(await repo.findById(options.unknownId)).toBeUndefined();
    });

    it("replaces the stored entity when saved again", async () => {
      const repo = await options.make();
      const entity = options.sample(1);
      await repo.save(entity);
      const changed = options.modify(entity);
      await repo.save(changed);
      expect(await repo.findById(entity.id)).toEqual(changed);
    });

    it("is not affected when callers mutate saved or returned objects", async () => {
      const repo = await options.make();
      const entity = options.sample(1);
      const snapshot = structuredClone(entity);
      await repo.save(entity);
      Object.assign(entity, options.modify(entity));
      const found = await repo.findById(snapshot.id);
      expect(found).toEqual(snapshot);
      if (found !== undefined) Object.assign(found, options.modify(found));
      expect(await repo.findById(snapshot.id)).toEqual(snapshot);
    });
  });
}

const ws = (n: number) => workspaceId(`ws_${n}`);
const prod = (n: number) => productId(`prod_${n}`);
const camp = (n: number) => campaignId(`camp_${n}`);

export function describeWorkspaceRepositoryContract(
  name: string,
  make: Make<WorkspaceRepository>,
): void {
  describeRepositoryContract(name, {
    make,
    sample: (n) => aWorkspace({ id: ws(n), name: `Workspace ${n}` }),
    modify: (w) => ({ ...w, name: `${w.name} (renamed)` }),
    unknownId: workspaceId("ws_missing"),
  });

  describe(`WorkspaceRepository contract: ${name}`, () => {
    it("finds the workspace a founder owns", async () => {
      const repo = await make();
      const mine = aWorkspace({ id: ws(1), ownerId: userId("user_founder") });
      await repo.save(mine);
      expect(await repo.findByOwner(userId("user_founder"))).toEqual(mine);
      expect(await repo.findByOwner(userId("user_nobody"))).toBeUndefined();
    });
  });
}

export function describeProductRepositoryContract(
  name: string,
  make: Make<ProductRepository>,
): void {
  describeRepositoryContract(name, {
    make,
    sample: (n) => aProduct({ id: prod(n), name: `Product ${n}` }),
    modify: (p) => ({ ...p, name: `${p.name} v2` }),
    unknownId: productId("prod_missing"),
  });

  describe(`ProductRepository contract: ${name}`, () => {
    it("lists only the products of the given workspace", async () => {
      const repo = await make();
      const mine = [
        aProduct({ id: prod(1), workspaceId: ws(1) }),
        aProduct({ id: prod(2), workspaceId: ws(1) }),
      ];
      await Promise.all(
        [...mine, aProduct({ id: prod(3), workspaceId: ws(2) })].map((p) => repo.save(p)),
      );
      const listed = await repo.listByWorkspace(ws(1));
      expect([...listed].sort((a, b) => a.id.localeCompare(b.id))).toEqual(mine);
      expect(await repo.listByWorkspace(ws(99))).toEqual([]);
    });

    it("lists the products whose autopilot is on, by id, and keeps when it was switched on", async () => {
      const repo = await make();
      const since = new Date("2026-10-19T09:00:00.000Z");
      const on = [
        enableAutopilot(aProduct({ id: prod(2) }), since),
        enableAutopilot(aProduct({ id: prod(1) }), since),
      ];
      await Promise.all([...on, aProduct({ id: prod(3) })].map((p) => repo.save(p)));
      expect(await repo.listWithAutopilot()).toEqual([on[1], on[0]]);
      expect((await repo.findById(prod(1)))?.autopilotSince).toEqual(since);
    });

    it("keeps the language and market the product writes for", async () => {
      const repo = await make();
      const product = { ...aProduct({ id: prod(1) }), locale: { language: "pt", market: "BR" } };
      await repo.save(product);
      expect((await repo.findById(prod(1)))?.locale).toEqual({ language: "pt", market: "BR" });
    });
  });
}

export function describeBriefRepositoryContract(name: string, make: Make<BriefRepository>): void {
  describeRepositoryContract(name, {
    make,
    sample: (n) => aBrief({ id: briefId(`brief_${n}`) }),
    modify: (b) => ({ ...b, version: b.version + 1 }),
    unknownId: briefId("brief_missing"),
  });

  describe(`BriefRepository contract: ${name}`, () => {
    it("finds the most recently updated brief for a product", async () => {
      const repo = await make();
      const older = aBrief({
        id: briefId("brief_1"),
        productId: prod(1),
        updatedAt: new Date("2026-01-01"),
      });
      const newer = aBrief({
        id: briefId("brief_2"),
        productId: prod(1),
        updatedAt: new Date("2026-02-01"),
      });
      const otherProduct = aBrief({
        id: briefId("brief_3"),
        productId: prod(2),
        updatedAt: new Date("2026-03-01"),
      });
      await Promise.all([older, newer, otherProduct].map((b) => repo.save(b)));
      expect(await repo.findLatestForProduct(prod(1))).toEqual(newer);
    });

    it("returns undefined when a product has no brief", async () => {
      const repo = await make();
      expect(await repo.findLatestForProduct(prod(1))).toBeUndefined();
    });
  });
}

export function describeCampaignRepositoryContract(
  name: string,
  make: Make<CampaignRepository>,
): void {
  describeRepositoryContract(name, {
    make,
    sample: (n) => aCampaign({ id: camp(n) }),
    modify: (c) => ({ ...c, goal: `${c.goal}!` }),
    unknownId: campaignId("camp_missing"),
  });

  describe(`CampaignRepository contract: ${name}`, () => {
    it("lists only the campaigns of the given product", async () => {
      const repo = await make();
      const mine = aCampaign({ id: camp(1), productId: prod(1) });
      await Promise.all(
        [mine, aCampaign({ id: camp(2), productId: prod(2) })].map((c) => repo.save(c)),
      );
      expect(await repo.listByProduct(prod(1))).toEqual([mine]);
    });
  });
}

export function describeTaskRepositoryContract(name: string, make: Make<TaskRepository>): void {
  describeRepositoryContract(name, {
    make,
    sample: (n) => aTask({ id: taskId(`task_${n}`) }),
    modify: (t) => ({ ...t, title: `${t.title} (edited)` }),
    unknownId: taskId("task_missing"),
  });

  describe(`TaskRepository contract: ${name}`, () => {
    it("lists only the tasks of the given campaign", async () => {
      const repo = await make();
      const mine = aTask({ id: taskId("task_1"), campaignId: camp(1) });
      await Promise.all(
        [mine, aTask({ id: taskId("task_2"), campaignId: camp(2) })].map((t) => repo.save(t)),
      );
      expect(await repo.listByCampaign(camp(1))).toEqual([mine]);
    });
  });
}

export function describeContentItemRepositoryContract(
  name: string,
  make: Make<ContentItemRepository>,
): void {
  describeRepositoryContract(name, {
    make,
    sample: (n) => aContentItem({ id: contentItemId(`item_${n}`) }),
    modify: (i) => ({ ...i, body: `${i.body} Updated.` }),
    unknownId: contentItemId("item_missing"),
  });

  describe(`ContentItemRepository contract: ${name}`, () => {
    it("keeps the reviewer agent's verdict with the item", async () => {
      const repo = await make();
      const review = reviewOf(
        { decision: "needs_changes", issues: [{ severity: "blocker", message: "Too long" }] },
        { redrafted: true, at: new Date("2026-10-19T07:05:00.000Z") },
      );
      const item = withAgentReview(aContentItem({ id: contentItemId("item_reviewed") }), review);
      await repo.save(item);
      expect(await repo.findById(item.id)).toEqual(item);
    });

    it("keeps an article's URL slug and excerpt, and no metadata for items without it", async () => {
      const repo = await make();
      const article = {
        ...aContentItem({ id: contentItemId("item_seo") }),
        seo: { slug: "cookieless-analytics", excerpt: "Five numbers a week, no cookies." },
      };
      const plain = aContentItem({ id: contentItemId("item_plain") });
      await Promise.all([repo.save(article), repo.save(plain)]);
      expect((await repo.findById(article.id))?.seo).toEqual(article.seo);
      expect((await repo.findById(plain.id))?.seo).toBeNull();
    });

    it("lists only the items in the given status", async () => {
      const repo = await make();
      const scheduled = aContentItem({ id: contentItemId("item_1"), status: "scheduled" });
      const draft = aContentItem({ id: contentItemId("item_2"), status: "draft" });
      await Promise.all([scheduled, draft].map((i) => repo.save(i)));
      expect(await repo.listByStatus("scheduled")).toEqual([scheduled]);
      expect(await repo.listByStatus("published")).toEqual([]);
    });

    it("lists the items in a status for the given products only", async () => {
      const repo = await make();
      const mine = aContentItem({ id: contentItemId("item_1"), status: "in_review" });
      const otherProduct = aContentItem({
        id: contentItemId("item_2"),
        productId: productId("prod_2"),
        status: "in_review",
      });
      const otherStatus = aContentItem({ id: contentItemId("item_3"), status: "draft" });
      await Promise.all([mine, otherProduct, otherStatus].map((i) => repo.save(i)));
      expect(await repo.listByStatusForProducts("in_review", [productId("prod_1")])).toEqual([
        mine,
      ]);
      expect(await repo.listByStatusForProducts("in_review", [])).toEqual([]);
    });

    it("keeps the publish attempt count", async () => {
      const repo = await make();
      const scheduled = aContentItem({ id: contentItemId("item_1"), status: "scheduled" });
      const tried = { ...scheduled, publishAttempts: 2 };
      await repo.save(tried);
      expect(await repo.findById(tried.id)).toEqual(tried);
    });

    it("lists a product's items, newest first", async () => {
      const repo = await make();
      const older = aContentItem({
        id: contentItemId("item_1"),
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      });
      const newer = aContentItem({
        id: contentItemId("item_2"),
        createdAt: new Date("2026-03-02T00:00:00.000Z"),
      });
      const other = aContentItem({ id: contentItemId("item_3"), productId: productId("prod_2") });
      await Promise.all([older, newer, other].map((i) => repo.save(i)));
      expect(await repo.listByProduct(productId("prod_1"))).toEqual([newer, older]);
    });

    it("counts the items of the given products created since a date", async () => {
      const repo = await make();
      const at = (iso: string) => new Date(iso);
      await Promise.all(
        [
          aContentItem({ id: contentItemId("item_1"), createdAt: at("2026-02-28T23:59:59.000Z") }),
          aContentItem({ id: contentItemId("item_2"), createdAt: at("2026-03-01T00:00:00.000Z") }),
          aContentItem({ id: contentItemId("item_3"), createdAt: at("2026-03-15T00:00:00.000Z") }),
          aContentItem({
            id: contentItemId("item_4"),
            productId: productId("prod_2"),
            createdAt: at("2026-03-15T00:00:00.000Z"),
          }),
        ].map((i) => repo.save(i)),
      );
      const since = at("2026-03-01T00:00:00.000Z");
      expect(await repo.countCreatedSince([productId("prod_1")], since)).toBe(2);
      expect(await repo.countCreatedSince([productId("prod_1"), productId("prod_2")], since)).toBe(
        3,
      );
      expect(await repo.countCreatedSince([], since)).toBe(0);
    });
  });
}

export function describeChannelConnectionRepositoryContract(
  name: string,
  make: Make<ChannelConnectionRepository>,
): void {
  describe(`ChannelConnectionRepository contract: ${name}`, () => {
    it("finds a product's connection for a channel", async () => {
      const repo = await make();
      const mine = aBlogConnection();
      await repo.save(mine);
      await repo.save(
        aBlogConnection({ id: channelConnectionId("conn_2"), productId: productId("prod_2") }),
      );
      expect(await repo.findByProductAndChannel(productId("prod_1"), "blog")).toEqual(mine);
    });

    it("returns undefined when the product has no connection for the channel", async () => {
      const repo = await make();
      await repo.save(aBlogConnection());
      expect(await repo.findByProductAndChannel(productId("prod_1"), "x")).toBeUndefined();
      expect(await repo.findByProductAndChannel(productId("prod_2"), "blog")).toBeUndefined();
    });

    it("replaces the connection when the product reconnects the same channel", async () => {
      const repo = await make();
      await repo.save(aBlogConnection());
      const replacement = aBlogConnection({
        id: channelConnectionId("conn_new"),
        siteUrl: "https://news.acme.dev",
      });
      await repo.save(replacement);
      expect(await repo.findByProductAndChannel(productId("prod_1"), "blog")).toEqual(replacement);
    });
  });
}
