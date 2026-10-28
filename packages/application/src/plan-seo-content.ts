import {
  all,
  campaignId,
  createCampaign,
  createTask,
  err,
  ok,
  rankKeywordOpportunities,
  taskId,
  transitionCampaign,
  type Campaign,
  type SeoTarget,
  type ProductId,
  type Result,
  type Task,
  type Workspace,
} from "@nuvantre/domain";
import type {
  BriefRepository,
  CampaignRepository,
  Clock,
  IdGenerator,
  KeywordError,
  KeywordProvider,
  ProductRepository,
  SubscriptionRepository,
  TaskRepository,
  WorkspaceRepository,
} from "@nuvantre/ports";
import { loadApprovedBrief } from "./approved-brief";
import { failure, type UseCaseError } from "./errors";
import { loadActiveProduct } from "./active-product";

const ARTICLES_PER_PLAN = 4;
const IDEAS_TO_CONSIDER = 50;

export interface SeoPlan {
  readonly campaign: Campaign;
  readonly tasks: readonly Task[];
  /** "unavailable" when the provider has no search data for the product's market. */
  readonly searchData: "available" | "unavailable";
}

interface Target {
  readonly title: string;
  readonly seo?: SeoTarget;
}

/** Without search data, each of the founder's own topics (up to the plan size) becomes an article. */
const topicsOf = (seeds: readonly string[]): Target[] =>
  [...new Set(seeds.map((s) => s.trim()).filter((s) => s !== ""))]
    .slice(0, ARTICLES_PER_PLAN)
    .map((topic) => ({ title: `Article: ${topic}` }));

/** Researches keywords for the founder's topics and plans one article per best opportunity. */
export class PlanSeoContent {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly subscriptions: SubscriptionRepository;
      readonly workspaces: WorkspaceRepository;
      readonly briefs: BriefRepository;
      readonly campaigns: CampaignRepository;
      readonly tasks: TaskRepository;
      readonly keywords: KeywordProvider;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
    seeds: readonly string[];
  }): Promise<Result<SeoPlan, UseCaseError | KeywordError>> {
    const product = await loadActiveProduct(this.deps, input.workspace, input.productId);
    if (!product.ok) return product;
    const brief = await loadApprovedBrief(this.deps.briefs, product.value.id);
    if (!brief.ok) return brief;

    const ideas = await this.deps.keywords.suggest({
      seeds: input.seeds,
      locale: product.value.locale,
      limit: IDEAS_TO_CONSIDER,
    });
    const searchData =
      !ideas.ok && ideas.error.code === "unsupported_market" ? "unavailable" : "available";
    if (!ideas.ok && searchData === "available") return ideas;
    const targets: Target[] = ideas.ok
      ? rankKeywordOpportunities(ideas.value, { max: ARTICLES_PER_PLAN }).map((seo) => ({
          title: `Article: ${seo.keyword}`,
          seo,
        }))
      : topicsOf(input.seeds);
    if (targets.length === 0) {
      return err(
        failure(
          "no_keyword_opportunities",
          "None of the keyword ideas for those topics are realistic to rank for. Try broader or different topics.",
        ),
      );
    }

    const now = this.deps.clock.now();
    const planned = createCampaign({
      id: campaignId(this.deps.ids.next()),
      productId: product.value.id,
      name: `SEO plan: ${now.toISOString().slice(0, 10)}`,
      goal:
        searchData === "available"
          ? `Rank for ${targets.map((t) => `"${t.seo?.keyword ?? t.title}"`).join(", ")}`
          : `Write about ${targets.map((t) => `"${t.title.replace(/^Article: /, "")}"`).join(", ")}`,
      weekStarting: now,
    });
    if (!planned.ok) return planned;
    const campaign = transitionCampaign(planned.value, "start");
    if (!campaign.ok) return campaign;
    const tasks = all(
      targets.map(({ title, seo }) =>
        createTask({
          id: taskId(this.deps.ids.next()),
          campaignId: campaign.value.id,
          kind: "seo_article",
          title,
          ...(seo ? { seo } : {}),
        }),
      ),
    );
    if (!tasks.ok) return tasks;

    await this.deps.campaigns.save(campaign.value);
    await Promise.all(tasks.value.map((task) => this.deps.tasks.save(task)));
    return ok({ campaign: campaign.value, tasks: tasks.value, searchData });
  }
}
