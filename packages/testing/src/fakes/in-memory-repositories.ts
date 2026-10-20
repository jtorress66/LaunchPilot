import type {
  Channel,
  ChannelConnection,
  SocialProfile,
  Directory,
  LaunchKit,
  Submission,
  SubmissionId,
  Email,
  Session,
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
  Workspace,
  WorkspaceId,
} from "@launchpilot/domain";
import type {
  BriefRepository,
  CampaignRepository,
  ChannelConnectionRepository,
  SocialProfileRepository,
  DirectoryCatalog,
  LaunchKitRepository,
  SubmissionRepository,
  ContentItemRepository,
  ProductRepository,
  Repository,
  SessionRepository,
  SubscriptionRepository,
  UserRepository,
  TaskRepository,
  WorkspaceRepository,
} from "@launchpilot/ports";
import { InMemoryStore } from "./in-memory-store";

/** findById/save shared by every in-memory repository, composed around one store. */
class StoreRepository<Id, T extends { readonly id: Id }> implements Repository<Id, T> {
  readonly store = new InMemoryStore<Id, T>((entity) => entity.id);

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

  findByOwner(ownerId: UserId): Promise<Workspace | undefined> {
    return Promise.resolve(this.base.store.filter((w) => w.ownerId === ownerId)[0]);
  }
}

export class InMemoryUserRepository implements UserRepository {
  private readonly base = new StoreRepository<UserId, User>();
  readonly findById = this.base.findById.bind(this.base);
  readonly save = this.base.save.bind(this.base);

  findByEmail(email: Email): Promise<User | undefined> {
    return Promise.resolve(this.base.store.filter((u) => u.email === email)[0]);
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly store = new InMemoryStore<string, Session>((session) => session.token);

  findByToken(token: string): Promise<Session | undefined> {
    return Promise.resolve(this.store.get(token));
  }

  save(session: Session): Promise<void> {
    this.store.put(session);
    return Promise.resolve();
  }

  delete(token: string): Promise<void> {
    this.store.delete(token);
    return Promise.resolve();
  }
}

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly store = new InMemoryStore<WorkspaceId, Subscription>((s) => s.workspaceId);

  findByWorkspace(workspaceId: WorkspaceId): Promise<Subscription | undefined> {
    return Promise.resolve(this.store.get(workspaceId));
  }

  findByProviderSubscriptionId(providerSubscriptionId: string): Promise<Subscription | undefined> {
    return Promise.resolve(
      this.store.filter((s) => s.providerSubscriptionId === providerSubscriptionId)[0],
    );
  }

  save(subscription: Subscription): Promise<void> {
    this.store.put(subscription);
    return Promise.resolve();
  }
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

  listByStatusForProducts(
    status: ContentItemStatus,
    productIds: readonly ProductId[],
  ): Promise<readonly ContentItem[]> {
    return Promise.resolve(
      this.base.store.filter((i) => i.status === status && productIds.includes(i.productId)),
    );
  }

  listByProduct(productId: ProductId): Promise<readonly ContentItem[]> {
    return Promise.resolve(
      this.base.store
        .filter((i) => i.productId === productId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    );
  }

  countCreatedSince(productIds: readonly ProductId[], since: Date): Promise<number> {
    return Promise.resolve(
      this.base.store.filter(
        (i) => productIds.includes(i.productId) && i.createdAt.getTime() >= since.getTime(),
      ).length,
    );
  }
}

export class InMemoryChannelConnectionRepository implements ChannelConnectionRepository {
  private readonly store = new InMemoryStore<string, ChannelConnection>(
    (c) => `${c.productId}:${c.channel}`,
  );

  findByProductAndChannel(
    productId: ProductId,
    channel: Channel,
  ): Promise<ChannelConnection | undefined> {
    return Promise.resolve(this.store.get(`${productId}:${channel}`));
  }

  save(connection: ChannelConnection): Promise<void> {
    this.store.put(connection);
    return Promise.resolve();
  }
}

export class InMemorySocialProfileRepository implements SocialProfileRepository {
  private readonly store = new InMemoryStore<ProductId, SocialProfile>((p) => p.productId);

  findByProduct(productId: ProductId): Promise<SocialProfile | undefined> {
    return Promise.resolve(this.store.get(productId));
  }

  save(profile: SocialProfile): Promise<void> {
    this.store.put(profile);
    return Promise.resolve();
  }
}

export class InMemoryDirectoryCatalog implements DirectoryCatalog {
  private readonly store = new InMemoryStore<string, Directory>((d) => d.slug);

  constructor(directories: readonly Directory[] = []) {
    for (const directory of directories) this.store.put(directory);
  }

  list(): Promise<readonly Directory[]> {
    return Promise.resolve(this.store.filter(() => true));
  }

  findBySlug(slug: string): Promise<Directory | undefined> {
    return Promise.resolve(this.store.get(slug));
  }
}

export class InMemoryLaunchKitRepository implements LaunchKitRepository {
  private readonly store = new InMemoryStore<string, LaunchKit>((kit) => kit.id);

  findLatestForProduct(productId: ProductId): Promise<LaunchKit | undefined> {
    return Promise.resolve(
      this.store
        .filter((kit) => kit.productId === productId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0],
    );
  }

  save(kit: LaunchKit): Promise<void> {
    this.store.put(kit);
    return Promise.resolve();
  }
}

export class InMemorySubmissionRepository implements SubmissionRepository {
  private readonly store = new InMemoryStore<SubmissionId, Submission>((s) => s.id);

  findById(id: SubmissionId): Promise<Submission | undefined> {
    return Promise.resolve(this.store.get(id));
  }

  findByProductAndDirectory(
    productId: ProductId,
    directorySlug: string,
  ): Promise<Submission | undefined> {
    return Promise.resolve(
      this.store.filter((s) => s.productId === productId && s.directorySlug === directorySlug)[0],
    );
  }

  listByProduct(productId: ProductId): Promise<readonly Submission[]> {
    return Promise.resolve(
      this.store
        .filter((s) => s.productId === productId)
        .sort((a, b) => a.directorySlug.localeCompare(b.directorySlug)),
    );
  }

  save(submission: Submission): Promise<void> {
    this.store.put(submission);
    return Promise.resolve();
  }
}
