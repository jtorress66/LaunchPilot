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

/**
 * Persistence for one aggregate. Infrastructure failures reject the promise;
 * use cases translate them into Result errors.
 */
export interface Repository<Id, T> {
  findById(id: Id): Promise<T | undefined>;
  /** Inserts or replaces the entity with the same id. */
  save(entity: T): Promise<void>;
}

export type WorkspaceRepository = Repository<WorkspaceId, Workspace>;

export interface ProductRepository extends Repository<ProductId, Product> {
  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Product[]>;
}

export interface BriefRepository extends Repository<BriefId, Brief> {
  findLatestForProduct(productId: ProductId): Promise<Brief | undefined>;
}

export interface CampaignRepository extends Repository<CampaignId, Campaign> {
  listByProduct(productId: ProductId): Promise<readonly Campaign[]>;
}

export interface TaskRepository extends Repository<TaskId, Task> {
  listByCampaign(campaignId: CampaignId): Promise<readonly Task[]>;
}

export interface ContentItemRepository extends Repository<ContentItemId, ContentItem> {
  listByStatus(status: ContentItemStatus): Promise<readonly ContentItem[]>;
}
