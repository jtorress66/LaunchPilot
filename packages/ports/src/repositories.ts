import type {
  AutopilotRun,
  AnalyticsConnection,
  AnalyticsProvider,
  Channel,
  ChannelConnection,
  Email,
  Session,
  SocialProfile,
  Directory,
  LaunchKit,
  Submission,
  SubmissionId,
  Subscription,
  User,
  UserId,
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
  WeeklyReport,
  Workspace,
  WorkspaceId,
} from "@nuvantre/domain";

/**
 * Persistence for one aggregate. Infrastructure failures reject the promise;
 * use cases translate them into Result errors.
 */
export interface Repository<Id, T> {
  findById(id: Id): Promise<T | undefined>;
  /** Inserts or replaces the entity with the same id. */
  save(entity: T): Promise<void>;
}

export interface WorkspaceRepository extends Repository<WorkspaceId, Workspace> {
  /** One founder owns one workspace for now. */
  findByOwner(ownerId: UserId): Promise<Workspace | undefined>;
}

export interface UserRepository extends Repository<UserId, User> {
  findByEmail(email: Email): Promise<User | undefined>;
}

/** Implementations must store only a hash of the token, never the token itself. */
export interface SessionRepository {
  findByToken(token: string): Promise<Session | undefined>;
  save(session: Session): Promise<void>;
  delete(token: string): Promise<void>;
}

export interface SubscriptionRepository {
  findByWorkspace(workspaceId: WorkspaceId): Promise<Subscription | undefined>;
  findByProviderSubscriptionId(providerSubscriptionId: string): Promise<Subscription | undefined>;
  /** Inserts or replaces the subscription of the same workspace. */
  save(subscription: Subscription): Promise<void>;
}

export interface ProductRepository extends Repository<ProductId, Product> {
  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Product[]>;
  /** Products whose weekly autopilot is on, ordered by id: the weekly loop's work list. */
  listWithAutopilot(): Promise<readonly Product[]>;
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
  listByStatusForProducts(
    status: ContentItemStatus,
    productIds: readonly ProductId[],
  ): Promise<readonly ContentItem[]>;
  /** Newest first. */
  listByProduct(productId: ProductId): Promise<readonly ContentItem[]>;
  /** Items of these products created at or after `since`, for monthly plan limits. */
  countCreatedSince(productIds: readonly ProductId[], since: Date): Promise<number>;
  /** How many items each product has in each status; statuses with none are left out. */
  countByStatus(productIds: readonly ProductId[]): Promise<readonly StatusCount[]>;
  /** How many items each product published at or after `since`; products with none are left out. */
  countPublishedSince(
    productIds: readonly ProductId[],
    since: Date,
  ): Promise<readonly ProductCount[]>;
}

export interface StatusCount {
  readonly productId: ProductId;
  readonly status: ContentItemStatus;
  readonly count: number;
}

export interface ProductCount {
  readonly productId: ProductId;
  readonly count: number;
}

export interface ChannelConnectionRepository {
  findByProductAndChannel(
    productId: ProductId,
    channel: Channel,
  ): Promise<ChannelConnection | undefined>;
  /** Inserts or replaces the connection for the same product and channel. */
  save(connection: ChannelConnection): Promise<void>;
}

export interface SocialProfileRepository {
  findByProduct(productId: ProductId): Promise<SocialProfile | undefined>;
  /** Inserts or replaces the profile of the same product. */
  save(profile: SocialProfile): Promise<void>;
}

/** The curated directory database. Read-only for the app; it is synced from data. */
export interface DirectoryCatalog {
  list(): Promise<readonly Directory[]>;
  findBySlug(slug: string): Promise<Directory | undefined>;
}

export interface LaunchKitRepository {
  findLatestForProduct(productId: ProductId): Promise<LaunchKit | undefined>;
  /** Inserts or replaces the kit with the same id. */
  save(kit: LaunchKit): Promise<void>;
}

export interface SubmissionRepository {
  findById(id: SubmissionId): Promise<Submission | undefined>;
  findByProductAndDirectory(
    productId: ProductId,
    directorySlug: string,
  ): Promise<Submission | undefined>;
  /** Ordered by directory slug. */
  listByProduct(productId: ProductId): Promise<readonly Submission[]>;
  /** Inserts or replaces the submission with the same id. */
  save(submission: Submission): Promise<void>;
}

export interface AnalyticsConnectionRepository {
  find<P extends AnalyticsProvider>(
    productId: ProductId,
    provider: P,
  ): Promise<Extract<AnalyticsConnection, { provider: P }> | undefined>;
  /** Ordered by provider. */
  listByProduct(productId: ProductId): Promise<readonly AnalyticsConnection[]>;
  /** Products with at least one connection, ordered by id: the weekly job's work list. */
  listConnectedProductIds(): Promise<readonly ProductId[]>;
  /** Inserts or replaces the connection for the same product and provider. */
  save(connection: AnalyticsConnection): Promise<void>;
  delete(productId: ProductId, provider: AnalyticsProvider): Promise<void>;
}

export interface WeeklyReportRepository {
  findByProductAndWeek(productId: ProductId, weekKey: string): Promise<WeeklyReport | undefined>;
  /** Newest week first. */
  listByProduct(productId: ProductId): Promise<readonly WeeklyReport[]>;
  /** Inserts or replaces the report for the same product and week. */
  save(report: WeeklyReport): Promise<void>;
}

export interface AutopilotRunRepository {
  findByProductAndWeek(productId: ProductId, weekStart: Date): Promise<AutopilotRun | undefined>;
  latestForProduct(productId: ProductId): Promise<AutopilotRun | undefined>;
  /** Inserts or replaces the run for the same product and week. */
  save(run: AutopilotRun): Promise<void>;
}
