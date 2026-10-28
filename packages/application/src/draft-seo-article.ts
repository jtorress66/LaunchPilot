import {
  andThen,
  contentItemId,
  createContentItem,
  publishedArticles,
  transition,
  transitionTask,
  type ContentItem,
  type Result,
  type TaskId,
  type Workspace,
} from "@nuvantre/domain";
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
  WorkspaceRepository,
} from "@nuvantre/ports";
import { ensureActive } from "./active-product";
import { loadApprovedBrief } from "./approved-brief";
import { checkContentAllowance } from "./content-allowance";
import type { UseCaseError } from "./errors";
import { loadOwnedTask } from "./owned-content";

/**
 * Has the SEO writer draft a task's article from the approved brief, then puts it in
 * review for the founder. Each draft counts against the plan's monthly allowance.
 */
export class DraftSeoArticle {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly briefs: BriefRepository;
      readonly campaigns: CampaignRepository;
      readonly tasks: TaskRepository;
      readonly contentItems: ContentItemRepository;
      readonly subscriptions: SubscriptionRepository;
      readonly workspaces: WorkspaceRepository;
      readonly writer: ContentDrafter;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    taskId: TaskId;
  }): Promise<Result<ContentItem, UseCaseError | DraftError>> {
    const owned = await loadOwnedTask(this.deps, input.workspace, input.taskId);
    if (!owned.ok) return owned;
    const { task, product } = owned.value;
    const active = await ensureActive(this.deps, product);
    if (!active.ok) return active;
    const brief = await loadApprovedBrief(this.deps.briefs, product.id);
    if (!brief.ok) return brief;

    const now = this.deps.clock.now();
    const allowed = await checkContentAllowance(this.deps, input.workspace);
    if (!allowed.ok) return allowed;

    const draft = await this.deps.writer.draft({
      brief: brief.value,
      channel: "blog",
      task: { kind: task.kind, title: task.title },
      ...(task.seo ? { keywords: [task.seo.keyword] } : {}),
      locale: product.locale,
      internalLinks: publishedArticles(await this.deps.contentItems.listByProduct(product.id)),
    });
    if (!draft.ok) return draft;

    const item = andThen(
      createContentItem({
        id: contentItemId(this.deps.ids.next()),
        productId: product.id,
        taskId: task.id,
        channel: "blog",
        title: draft.value.title,
        body: draft.value.body,
        ...(draft.value.seo ? { seo: draft.value.seo } : {}),
        createdBy: { kind: "agent", agent: "seo" },
        now,
      }),
      (created) => transition(created, { type: "submit" }, { now }),
    );
    if (!item.ok) return item;
    await this.deps.contentItems.save(item.value);
    if (task.status === "todo") {
      const started = transitionTask(task, "start");
      if (started.ok) await this.deps.tasks.save(started.value);
    }
    return item;
  }
}
