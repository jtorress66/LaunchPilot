import {
  andThen,
  autopilotRunId,
  campaignId,
  contentItemId,
  createCampaign,
  createContentItem,
  createTask,
  disableAutopilot,
  enableAutopilot,
  loopIsDue,
  loopWeekOf,
  ok,
  planPostAngles,
  previousWeek,
  rankKeywordOpportunities,
  reviewOf,
  taskId,
  transition,
  transitionCampaign,
  transitionTask,
  weekKey,
  withAgentReview,
  type AcceptedTask,
  type AgentReview,
  type AutopilotRun,
  type AutopilotRunOutcome,
  type BriefContent,
  type Campaign,
  type Product,
  type ProductId,
  type ReportWeek,
  type Result,
  type WeekCandidates,
  type WeeklyReport,
  type Workspace,
  validateWeekPlan,
  publishedArticles,
  type InternalLink,
} from "@nuvantre/domain";
import type {
  AutopilotRunRepository,
  BriefRepository,
  CampaignPlanner,
  CampaignRepository,
  Clock,
  ContentItemRepository,
  ContentReviewer,
  IdGenerator,
  KeywordProvider,
  ProductRepository,
  SubscriptionRepository,
  TaskRepository,
  WeeklyReportRepository,
  WorkspaceRepository,
} from "@nuvantre/ports";
import { loadApprovedBrief } from "./approved-brief";
import { remainingContentAllowance } from "./content-allowance";
import type { DrafterRegistry } from "./drafter-registry";
import type { UseCaseError } from "./errors";
import { ensureActive, loadActiveProduct } from "./active-product";
import { loadOwnedProduct } from "./owned-product";

const KEYWORD_IDEAS = 50;
const KEYWORD_CANDIDATES = 6;
const SEEDS_FROM_REPORT = 5;
const SEEDS_FROM_BRIEF = 3;
const ANGLES = { x: 3, linkedin: 2 } as const;

const agentFor = { seo_article: "seo", social_post: "social" } as const;

interface Tally {
  drafted: number;
  redrafted: number;
  failed: number;
}

export interface WeeklyLoopDeps {
  readonly workspaces: WorkspaceRepository;
  readonly products: ProductRepository;
  readonly briefs: BriefRepository;
  readonly campaigns: CampaignRepository;
  readonly tasks: TaskRepository;
  readonly contentItems: ContentItemRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly weeklyReports: WeeklyReportRepository;
  readonly autopilotRuns: AutopilotRunRepository;
  readonly keywords: KeywordProvider;
  readonly planner: CampaignPlanner;
  readonly drafters: DrafterRegistry;
  readonly reviewer: ContentReviewer;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/**
 * One product's week: plan from grounded candidates, draft each task, review it, redraft once for
 * blockers, and leave every item in review for the founder. It never approves or publishes.
 * A failed draft or review is counted and the rest of the week still runs.
 */
/** What every task of one product's week is drafted and reviewed against. */
interface WeekContext {
  readonly brief: BriefContent;
  readonly product: Product;
  readonly published: readonly InternalLink[];
}

export class RunWeeklyLoop {
  constructor(private readonly deps: WeeklyLoopDeps) {}

  async execute(input: {
    product: Product;
    week: ReportWeek;
    /** Re-run a skipped or failed week; a completed week never runs twice. */
    retry: boolean;
  }): Promise<AutopilotRun> {
    const { product, week } = input;
    const existing = await this.deps.autopilotRuns.findByProductAndWeek(product.id, week.start);
    if (existing && (!input.retry || existing.outcome.kind === "completed")) return existing;

    const outcome = await this.run(product, week);
    const run: AutopilotRun = {
      id: existing?.id ?? autopilotRunId(this.deps.ids.next()),
      productId: product.id,
      week,
      outcome,
      ranAt: this.deps.clock.now(),
    };
    await this.deps.autopilotRuns.save(run);
    return run;
  }

  private async run(product: Product, week: ReportWeek): Promise<AutopilotRunOutcome> {
    const brief = await loadApprovedBrief(this.deps.briefs, product.id);
    if (!brief.ok) return { kind: "skipped", reason: brief.error.message };
    const workspace = await this.deps.workspaces.findById(product.workspaceId);
    if (!workspace) return { kind: "skipped", reason: "The product's workspace is missing" };

    const lastWeek =
      (await this.deps.weeklyReports.findByProductAndWeek(
        product.id,
        weekKey(previousWeek(week)),
      )) ?? null;
    const published = publishedArticles(await this.deps.contentItems.listByProduct(product.id));
    const candidates = await this.candidates(product, brief.value, lastWeek, published);
    const allowance = await remainingContentAllowance(this.deps, workspace);
    const plan = await this.deps.planner.plan({
      product: { name: product.name },
      brief: brief.value,
      week,
      lastWeek,
      allowance,
      candidates,
    });
    if (!plan.ok) return { kind: "failed", reason: plan.error.message };

    const checked = validateWeekPlan(plan.value.tasks, { allowance, candidates });
    const campaign = andThen(
      createCampaign({
        id: campaignId(this.deps.ids.next()),
        productId: product.id,
        name: plan.value.name,
        goal: plan.value.goal,
        weekStarting: week.start,
      }),
      (planned) => transitionCampaign(planned, "start"),
    );
    if (!campaign.ok) return { kind: "failed", reason: campaign.error.message };
    await this.deps.campaigns.save(campaign.value);

    const tally: Tally = { drafted: 0, redrafted: 0, failed: 0 };
    for (const task of checked.accepted) {
      await this.draftTask(campaign.value, task, { brief: brief.value, product, published }, tally);
    }
    return {
      kind: "completed",
      campaignId: campaign.value.id,
      summary: {
        planned: checked.accepted.length,
        dropped: checked.dropped.length,
        ...tally,
        stoppedAtLimit: checked.dropped.some((d) => d.reason === "over_allowance"),
      },
    };
  }

  /** Keywords researched from last week's searches and the brief, plus brief-derived angles. */
  private async candidates(
    product: Product,
    brief: BriefContent,
    lastWeek: WeeklyReport | null,
    published: readonly InternalLink[],
  ): Promise<WeekCandidates> {
    const topics = [
      ...(lastWeek?.topQueries.slice(0, SEEDS_FROM_REPORT).map((q) => q.query) ?? []),
      ...brief.differentiators.slice(0, SEEDS_FROM_BRIEF),
    ];
    // A new product has no searches and may have no differentiators yet: start from its problem.
    const seeds = topics.length > 0 ? topics : [brief.problem];
    const ideas = await this.deps.keywords.suggest({
      seeds,
      locale: product.locale,
      limit: KEYWORD_IDEAS,
    });
    const [article] = published;
    return {
      keywords: ideas.ok ? rankKeywordOpportunities(ideas.value, { max: KEYWORD_CANDIDATES }) : [],
      angles: planPostAngles(brief, { ...ANGLES, ...(article ? { latestArticle: article } : {}) }),
    };
  }

  private async draftTask(campaign: Campaign, task: AcceptedTask, week: WeekContext, tally: Tally) {
    const { brief, product, published } = week;
    const drafter = this.deps.drafters.for(task.channel);
    const created = andThen(
      createTask({
        id: taskId(this.deps.ids.next()),
        campaignId: campaign.id,
        kind: task.kind,
        title: task.title,
        ...(task.kind === "seo_article" ? { seo: task.seo } : {}),
      }),
      (t) => transitionTask(t, "start"),
    );
    if (!drafter || !created.ok) {
      tally.failed += 1;
      return;
    }
    const link =
      task.kind === "social_post" && task.angle.link !== null ? task.angle.link : undefined;
    const request = {
      brief,
      channel: task.channel,
      task: { kind: task.kind, title: task.title },
      ...(task.kind === "seo_article" ? { keywords: [task.seo.keyword] } : {}),
      ...(link === undefined ? {} : { link }),
      locale: product.locale,
      // Articles may link only to the product's published articles.
      ...(task.kind === "seo_article" ? { internalLinks: published } : {}),
    };
    const first = await drafter.draft(request);
    if (!first.ok) {
      tally.failed += 1;
      return;
    }
    let draft = first.value;
    let review = await this.review(week, task, draft, link, false);
    if (review?.issues.some((i) => i.severity === "blocker")) {
      const revisionNote = review.issues
        .filter((i) => i.severity === "blocker")
        .map((i) => i.message)
        .join("\n");
      const second = await drafter.draft({ ...request, revisionNote });
      if (second.ok) {
        draft = second.value;
        tally.redrafted += 1;
        review = await this.review(week, task, draft, link, true);
      }
    }

    const now = this.deps.clock.now();
    const item = andThen(
      createContentItem({
        id: contentItemId(this.deps.ids.next()),
        productId: campaign.productId,
        taskId: created.value.id,
        channel: task.channel,
        title: draft.title,
        body: draft.body,
        ...(draft.seo ? { seo: draft.seo } : {}),
        createdBy: { kind: "agent", agent: agentFor[task.kind] },
        now,
      }),
      (draftItem) => transition(draftItem, { type: "submit" }, { now }),
    );
    if (!item.ok) {
      tally.failed += 1;
      return;
    }
    await this.deps.tasks.save(created.value);
    await this.deps.contentItems.save(review ? withAgentReview(item.value, review) : item.value);
    tally.drafted += 1;
  }

  /** The reviewer's verdict, or null when the reviewer could not review (the item still goes on). */
  private async review(
    { brief, product }: WeekContext,
    task: AcceptedTask,
    draft: { title: string; body: string },
    link: string | undefined,
    redrafted: boolean,
  ): Promise<AgentReview | null> {
    const verdict = await this.deps.reviewer.review({
      brief,
      channel: task.channel,
      title: draft.title,
      body: draft.body,
      ...(link === undefined ? {} : { link }),
      locale: product.locale,
    });
    return verdict.ok ? reviewOf(verdict.value, { redrafted, at: this.deps.clock.now() }) : null;
  }
}

/** The founder's "Run this week now": this week's loop, re-running a skipped or failed week. */
export class RunAutopilotNow {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly subscriptions: SubscriptionRepository;
      readonly loop: RunWeeklyLoop;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<Result<AutopilotRun, UseCaseError>> {
    const product = await loadActiveProduct(this.deps, input.workspace, input.productId);
    if (!product.ok) return product;
    return ok(
      await this.deps.loop.execute({
        product: product.value,
        week: loopWeekOf(this.deps.clock.now()),
        retry: true,
      }),
    );
  }
}

const MAX_LOOPS_PER_RUN = 10;

/**
 * The worker's weekly job: from Monday 07:00 UTC, this week's loop for every product with the
 * autopilot on that has not run yet. A failed or skipped week is left for the founder to retry.
 */
export class RunDueLoops {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly subscriptions: SubscriptionRepository;
      readonly autopilotRuns: AutopilotRunRepository;
      readonly loop: RunWeeklyLoop;
      readonly clock: Clock;
    },
  ) {}

  async execute(): Promise<{ ran: number; skipped: number }> {
    const now = this.deps.clock.now();
    if (!loopIsDue(now)) return { ran: 0, skipped: 0 };
    const week = loopWeekOf(now);
    let ran = 0;
    let skipped = 0;
    for (const product of await this.deps.products.listWithAutopilot()) {
      if (
        (await this.deps.autopilotRuns.findByProductAndWeek(product.id, week.start)) ||
        !(await ensureActive(this.deps, product)).ok
      ) {
        skipped += 1;
        continue;
      }
      if (ran >= MAX_LOOPS_PER_RUN) continue;
      await this.deps.loop.execute({ product, week, retry: false });
      ran += 1;
    }
    return { ran, skipped };
  }
}

export class SetAutopilot {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly subscriptions: SubscriptionRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
    enabled: boolean;
  }): Promise<Result<Product, UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    if (input.enabled) {
      const active = await ensureActive(this.deps, product.value);
      if (!active.ok) return active;
    }
    const changed = input.enabled
      ? enableAutopilot(product.value, this.deps.clock.now())
      : disableAutopilot(product.value);
    await this.deps.products.save(changed);
    return ok(changed);
  }
}

export interface AutopilotStatus {
  readonly enabledSince: Date | null;
  readonly latest: AutopilotRun | null;
}

export class GetAutopilotStatus {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly autopilotRuns: AutopilotRunRepository;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<Result<AutopilotStatus, UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const latest = await this.deps.autopilotRuns.latestForProduct(product.value.id);
    return ok({ enabledSince: product.value.autopilotSince, latest: latest ?? null });
  }
}
