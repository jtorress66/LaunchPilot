import type {
  Brief,
  BriefId,
  Campaign,
  CampaignId,
  ContentItem,
  ContentItemId,
  ContentItemStatus,
  Product,
  ProductId,
  Task,
  TaskId,
  Workspace,
  WorkspaceId,
} from "@launchpilot/domain";
import type {
  BriefRepository,
  CampaignRepository,
  ContentItemRepository,
  ProductRepository,
  Repository,
  TaskRepository,
  WorkspaceRepository,
} from "@launchpilot/ports";
import { InMemoryStore } from "./in-memory-store";

/** findById/save shared by every in-memory repository, composed around one store. */
class StoreRepository<Id, T extends { readonly id: Id }> implements Repository<Id, T> {
  readonly store = new InMemoryStore<Id, T>();

  findById(id: Id): Promise<T | undefined> {
    return Promise.resolve(this.store.get(id));
  }

  save(entity: T): Promise<void> {
    this.store.put(entity);
    return Promise.resolve();
  }
}

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private readonly base = new StoreRepository<WorkspaceId, Workspace>();
  readonly findById = this.base.findById.bind(this.base);
  readonly save = this.base.save.bind(this.base);
}

export class InMemoryProductRepository implements ProductRepository {
  private readonly base = new StoreRepository<ProductId, Product>();
  readonly findById = this.base.findById.bind(this.base);
  readonly save = this.base.save.bind(this.base);

  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Product[]> {
    return Promise.resolve(this.base.store.filter((p) => p.workspaceId === workspaceId));
  }
}

export class InMemoryBriefRepository implements BriefRepository {
  private readonly base = new StoreRepository<BriefId, Brief>();
  readonly findById = this.base.findById.bind(this.base);
  readonly save = this.base.save.bind(this.base);

  findLatestForProduct(productId: ProductId): Promise<Brief | undefined> {
    const [latest] = this.base.store
      .filter((b) => b.productId === productId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return Promise.resolve(latest);
  }
}

export class InMemoryCampaignRepository implements CampaignRepository {
  private readonly base = new StoreRepository<CampaignId, Campaign>();
  readonly findById = this.base.findById.bind(this.base);
  readonly save = this.base.save.bind(this.base);

  listByProduct(productId: ProductId): Promise<readonly Campaign[]> {
    return Promise.resolve(this.base.store.filter((c) => c.productId === productId));
  }
}

export class InMemoryTaskRepository implements TaskRepository {
  private readonly base = new StoreRepository<TaskId, Task>();
  readonly findById = this.base.findById.bind(this.base);
  readonly save = this.base.save.bind(this.base);

  listByCampaign(campaignId: CampaignId): Promise<readonly Task[]> {
    return Promise.resolve(this.base.store.filter((t) => t.campaignId === campaignId));
  }
}

export class InMemoryContentItemRepository implements ContentItemRepository {
  private readonly base = new StoreRepository<ContentItemId, ContentItem>();
  readonly findById = this.base.findById.bind(this.base);
  readonly save = this.base.save.bind(this.base);

  listByStatus(status: ContentItemStatus): Promise<readonly ContentItem[]> {
    return Promise.resolve(this.base.store.filter((i) => i.status === status));
  }
}
