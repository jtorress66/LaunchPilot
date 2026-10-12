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
  type ProductId,
  type Result,
  type Task,
  type Workspace,
} from "@launchpilot/domain";
import type {
  BriefRepository,
  CampaignRepository,
  Clock,
  IdGenerator,
  KeywordError,
  KeywordProvider,
  ProductRepository,
  TaskRepository,
} from "@launchpilot/ports";
import { loadApprovedBrief } from "./approved-brief";
import { failure, type UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

const ARTICLES_PER_PLAN = 4;
const IDEAS_TO_CONSIDER = 50;

export interface SeoPlan {
  readonly campaign: Campaign;
  readonly tasks: readonly Task[];
}

/** Researches keywords for the founder's topics and plans one article per best opportunity. */
export class PlanSeoContent {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
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
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const brief = await loadApprovedBrief(this.deps.briefs, product.value.id);
    if (!brief.ok) return brief;

    const ideas = await this.deps.keywords.suggest({
      seeds: input.seeds,
      locale: "en-US",
      limit: IDEAS_TO_CONSIDER,
    });
    if (!ideas.ok) return ideas;
    const picks = rankKeywordOpportunities(ideas.value, { max: ARTICLES_PER_PLAN });
    if (picks.length === 0) {
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
      goal: `Rank for ${picks.map((p) => `"${p.keyword}"`).join(", ")}`,
      weekStarting: now,
    });
    if (!planned.ok) return planned;
    const campaign = transitionCampaign(planned.value, "start");
    if (!campaign.ok) return campaign;
    const tasks = all(
      picks.map((seo) =>
        createTask({
          id: taskId(this.deps.ids.next()),
          campaignId: campaign.value.id,
          kind: "seo_article",
          title: `Article: ${seo.keyword}`,
          seo,
        }),
      ),
    );
    if (!tasks.ok) return tasks;

    await this.deps.campaigns.save(campaign.value);
    await Promise.all(tasks.value.map((task) => this.deps.tasks.save(task)));
    return ok({ campaign: campaign.value, tasks: tasks.value });
  }
}
