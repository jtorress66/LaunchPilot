import {
  andThen,
  campaignId,
  communityChannels,
  contentItemId,
  createCampaign,
  createContentItem,
  createLaunchKit,
  createTask,
  editLaunchKit,
  launchKitId,
  ok,
  taskId,
  transition,
  transitionCampaign,
  transitionTask,
  type Channel,
  type ContentItem,
  type LaunchKit,
  type ProductId,
  type Result,
  type Workspace,
} from "@launchpilot/domain";
import type {
  BriefRepository,
  CampaignRepository,
  Clock,
  CommunityDraft,
  ContentItemRepository,
  DraftError,
  IdGenerator,
  LaunchKitDrafter,
  LaunchKitRepository,
  ProductRepository,
  SubscriptionRepository,
  TaskRepository,
} from "@launchpilot/ports";
import { loadApprovedBrief } from "./approved-brief";
import { checkContentAllowance } from "./content-allowance";
import type { UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

export interface GeneratedLaunchKit {
  readonly kit: LaunchKit;
  /** One draft post per community, in review. Never published automatically. */
  readonly community: readonly ContentItem[];
}

const isCommunity = (channel: Channel) =>
  (communityChannels as readonly Channel[]).includes(channel);
const STALE: readonly ContentItem["status"][] = ["draft", "in_review", "rejected"];

/**
 * Has the launch agent draft the product's launch kit from the approved brief. A regenerated kit
 * is a new version needing approval; earlier community drafts that were not approved are archived.
 */
export class GenerateLaunchKit {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly briefs: BriefRepository;
      readonly launchKits: LaunchKitRepository;
      readonly campaigns: CampaignRepository;
      readonly tasks: TaskRepository;
      readonly contentItems: ContentItemRepository;
      readonly subscriptions: SubscriptionRepository;
      readonly launchWriter: LaunchKitDrafter;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<Result<GeneratedLaunchKit, UseCaseError | DraftError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const brief = await loadApprovedBrief(this.deps.briefs, product.value.id);
    if (!brief.ok) return brief;
    const allowed = await checkContentAllowance(
      this.deps,
      input.workspace,
      communityChannels.length,
    );
    if (!allowed.ok) return allowed;

    const draft = await this.deps.launchWriter.draft({
      brief: brief.value,
      product: { name: product.value.name, url: product.value.url },
    });
    if (!draft.ok) return draft;

    const now = this.deps.clock.now();
    const existing = await this.deps.launchKits.findLatestForProduct(product.value.id);
    const kit = existing
      ? editLaunchKit(existing, draft.value.listing, { now })
      : createLaunchKit({
          id: launchKitId(this.deps.ids.next()),
          productId: product.value.id,
          listing: draft.value.listing,
          now,
        });
    if (!kit.ok) return kit;

    await this.archiveStaleDrafts(product.value.id);
    const community = await this.saveCommunityDrafts(product.value.id, draft.value.community);
    if (!community.ok) return community;
    await this.deps.launchKits.save(kit.value);
    return ok({ kit: kit.value, community: community.value });
  }

  private async archiveStaleDrafts(productId: ProductId): Promise<void> {
    const now = this.deps.clock.now();
    for (const item of await this.deps.contentItems.listByProduct(productId)) {
      if (!isCommunity(item.channel) || !STALE.includes(item.status)) continue;
      const archived = transition(item, { type: "archive" }, { now });
      if (archived.ok) await this.deps.contentItems.save(archived.value);
    }
  }

  private async saveCommunityDrafts(
    productId: ProductId,
    drafts: readonly CommunityDraft[],
  ): Promise<Result<ContentItem[], UseCaseError>> {
    const now = this.deps.clock.now();
    const campaign = andThen(
      createCampaign({
        id: campaignId(this.deps.ids.next()),
        productId,
        name: `Launch kit: ${now.toISOString().slice(0, 10)}`,
        goal: "Launch on platforms, directories and communities",
        weekStarting: now,
      }),
      (planned) => transitionCampaign(planned, "start"),
    );
    if (!campaign.ok) return campaign;
    await this.deps.campaigns.save(campaign.value);

    const items: ContentItem[] = [];
    for (const post of drafts) {
      const task = andThen(
        createTask({
          id: taskId(this.deps.ids.next()),
          campaignId: campaign.value.id,
          kind: "launch_submission",
          title: post.title,
        }),
        (created) => transitionTask(created, "start"),
      );
      if (!task.ok) return task;
      const item = andThen(
        createContentItem({
          id: contentItemId(this.deps.ids.next()),
          productId,
          taskId: task.value.id,
          channel: post.channel,
          title: post.title,
          body: post.body,
          createdBy: { kind: "agent", agent: "launch" },
          now,
        }),
        (created) => transition(created, { type: "submit" }, { now }),
      );
      if (!item.ok) return item;
      await this.deps.tasks.save(task.value);
      await this.deps.contentItems.save(item.value);
      items.push(item.value);
    }
    return ok(items);
  }
}
