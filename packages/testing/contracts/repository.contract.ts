import type {
  BriefRepository,
  CampaignRepository,
  ContentItemRepository,
  ProductRepository,
  Repository,
  TaskRepository,
  WorkspaceRepository,
} from "@launchpilot/ports";
import {
  briefId,
  campaignId,
  contentItemId,
  productId,
  taskId,
  userId,
  workspaceId,
} from "@launchpilot/domain";
import { describe, expect, it } from "vitest";
import {
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
    it("lists only the items in the given status", async () => {
      const repo = await make();
      const scheduled = aContentItem({ id: contentItemId("item_1"), status: "scheduled" });
      const draft = aContentItem({ id: contentItemId("item_2"), status: "draft" });
      await Promise.all([scheduled, draft].map((i) => repo.save(i)));
      expect(await repo.listByStatus("scheduled")).toEqual([scheduled]);
      expect(await repo.listByStatus("published")).toEqual([]);
    });
  });
}
