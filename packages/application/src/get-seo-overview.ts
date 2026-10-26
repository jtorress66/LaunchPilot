import {
  byOpportunity,
  ok,
  type Campaign,
  type ContentItem,
  type ContentItemId,
  type Product,
  type ProductId,
  type Result,
  type Task,
  type Workspace,
} from "@nuvantre/domain";
import type {
  BriefRepository,
  CampaignRepository,
  ChannelConnectionRepository,
  ContentItemRepository,
  ProductRepository,
  TaskRepository,
} from "@nuvantre/ports";
import type { UseCaseError } from "./errors";
import { loadOwnedItem, loadOwnedTask } from "./owned-content";
import { loadOwnedProduct } from "./owned-product";

export interface SeoOverview {
  readonly product: Product;
  readonly briefApproved: boolean;
  /** Never includes the encrypted secret. */
  readonly connection: { readonly siteName: string; readonly siteUrl: string } | null;
  readonly campaigns: readonly {
    readonly campaign: Campaign;
    readonly tasks: readonly { readonly task: Task; readonly item: ContentItem | undefined }[];
  }[];
}

interface ReadDeps {
  readonly products: ProductRepository;
  readonly briefs: BriefRepository;
  readonly campaigns: CampaignRepository;
  readonly tasks: TaskRepository;
  readonly contentItems: ContentItemRepository;
  readonly connections: ChannelConnectionRepository;
}

/** Everything the SEO page shows: blog connection, plans, and each task's latest article. */
export class GetSeoOverview {
  constructor(private readonly deps: ReadDeps) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<Result<SeoOverview, UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const id = product.value.id;
    const [brief, connection, campaigns, items] = await Promise.all([
      this.deps.briefs.findLatestForProduct(id),
      this.deps.connections.findByProductAndChannel(id, "blog"),
      this.deps.campaigns.listByProduct(id),
      this.deps.contentItems.listByProduct(id),
    ]);
    // Items come newest first, so the first one seen per task is its latest article.
    const latest = new Map<string, ContentItem>();
    for (const item of items) if (!latest.has(item.taskId)) latest.set(item.taskId, item);

    const plans = await Promise.all(
      [...campaigns]
        .sort((a, b) => b.weekStarting.getTime() - a.weekStarting.getTime())
        .map(async (campaign) => ({
          campaign,
          // Storage order is arbitrary; show the plan best opportunity first.
          tasks: [...(await this.deps.tasks.listByCampaign(campaign.id))]
            .sort((a, b) => (a.seo && b.seo ? byOpportunity(a.seo, b.seo) : 0))
            .map((task) => ({ task, item: latest.get(task.id) })),
        })),
    );
    return ok({
      product: product.value,
      briefApproved: brief?.status === "approved",
      connection: connection
        ? { siteName: connection.siteName, siteUrl: connection.siteUrl }
        : null,
      campaigns: plans,
    });
  }
}

/** One article with its task and product, for the article page. */
export class GetContentItem {
  constructor(private readonly deps: ReadDeps) {}

  async execute(input: {
    workspace: Workspace;
    itemId: ContentItemId;
  }): Promise<Result<{ item: ContentItem; task: Task; product: Product }, UseCaseError>> {
    const owned = await loadOwnedItem(this.deps, input.workspace, input.itemId);
    if (!owned.ok) return owned;
    const task = await loadOwnedTask(this.deps, input.workspace, owned.value.item.taskId);
    if (!task.ok) return task;
    return ok({ ...owned.value, task: task.value.task });
  }
}
