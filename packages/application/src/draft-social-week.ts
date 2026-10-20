import {
  andThen,
  campaignId,
  contentItemId,
  createCampaign,
  createContentItem,
  createTask,
  err,
  ok,
  planPostAngles,
  taskId,
  transition,
  transitionCampaign,
  transitionTask,
  type Campaign,
  type ContentItem,
  type PostAngle,
  type ProductId,
  type Result,
  type Workspace,
} from "@launchpilot/domain";
import type {
  BriefRepository,
  CampaignRepository,
  Clock,
  ContentDrafter,
  ContentItemRepository,
  DraftError,
  IdGenerator,
  ProductRepository,
  SubscriptionRepository,
  TaskRepository,
} from "@launchpilot/ports";
import { loadApprovedBrief } from "./approved-brief";
import { latestArticle } from "./latest-article";
import { checkContentAllowance } from "./content-allowance";
import type { UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

const POSTS_PER_WEEK = { x: 3, linkedin: 2 } as const;

export interface SocialWeek {
  readonly campaign: Campaign;
  readonly items: readonly ContentItem[];
  /** True when the plan's monthly allowance ran out before every post was drafted. */
  readonly stoppedAtLimit: boolean;
}

/**
 * Has the social writer draft a week of X and LinkedIn posts from the approved brief and
 * puts each in review. Each draft counts against the plan's allowance; drafting stops
 * cleanly when it runs out, keeping what was drafted.
 */
export class DraftSocialWeek {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly briefs: BriefRepository;
      readonly campaigns: CampaignRepository;
      readonly tasks: TaskRepository;
      readonly contentItems: ContentItemRepository;
      readonly subscriptions: SubscriptionRepository;
      readonly socialWriter: ContentDrafter;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<Result<SocialWeek, UseCaseError | DraftError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const brief = await loadApprovedBrief(this.deps.briefs, product.value.id);
    if (!brief.ok) return brief;
    const allowed = await checkContentAllowance(this.deps, input.workspace);
    if (!allowed.ok) return allowed;

    const article = latestArticle(await this.deps.contentItems.listByProduct(product.value.id));
    const angles = planPostAngles(brief.value, {
      ...POSTS_PER_WEEK,
      ...(article ? { latestArticle: article } : {}),
    });
    const campaign = this.startCampaign(product.value.id);
    if (!campaign.ok) return campaign;
    await this.deps.campaigns.save(campaign.value);

    const items: ContentItem[] = [];
    for (const angle of angles) {
      if (items.length > 0 && !(await checkContentAllowance(this.deps, input.workspace)).ok) {
        return ok({ campaign: campaign.value, items, stoppedAtLimit: true });
      }
      const item = await this.draftPost(campaign.value, angle, brief.value);
      if (!item.ok) {
        // Keep what was drafted; report the failure only when there is nothing to show.
        if (items.length > 0) break;
        return item;
      }
      items.push(item.value);
    }
    return ok({ campaign: campaign.value, items, stoppedAtLimit: false });
  }

  private startCampaign(productId: ProductId) {
    const now = this.deps.clock.now();
    return andThen(
      createCampaign({
        id: campaignId(this.deps.ids.next()),
        productId,
        name: `Social week: ${now.toISOString().slice(0, 10)}`,
        goal: "A week of X and LinkedIn posts from the Product Brief",
        weekStarting: now,
      }),
      (planned) => transitionCampaign(planned, "start"),
    );
  }

  private async draftPost(
    campaign: Campaign,
    angle: PostAngle,
    brief: Parameters<ContentDrafter["draft"]>[0]["brief"],
  ): Promise<Result<ContentItem, UseCaseError | DraftError>> {
    const task = andThen(
      createTask({
        id: taskId(this.deps.ids.next()),
        campaignId: campaign.id,
        kind: "social_post",
        title: angle.angle,
      }),
      (created) => transitionTask(created, "start"),
    );
    if (!task.ok) return task;
    const draft = await this.deps.socialWriter.draft({
      brief,
      channel: angle.channel,
      task: { kind: "social_post", title: angle.angle },
      ...(angle.link === null ? {} : { link: angle.link }),
    });
    if (!draft.ok) return draft;

    const now = this.deps.clock.now();
    const item = andThen(
      createContentItem({
        id: contentItemId(this.deps.ids.next()),
        productId: campaign.productId,
        taskId: task.value.id,
        channel: angle.channel,
        title: draft.value.title,
        body: draft.value.body,
        createdBy: { kind: "agent", agent: "social" },
        now,
      }),
      (created) => transition(created, { type: "submit" }, { now }),
    );
    if (!item.ok) return err(item.error);
    await this.deps.tasks.save(task.value);
    await this.deps.contentItems.save(item.value);
    return item;
  }
}
