import {
  buildWeeklyReport,
  err,
  lastCompleteWeek,
  ok,
  previousWeek,
  weeklyReportId,
  weekKey,
  withAnalystNotes,
  withoutAnalystNotes,
  type Product,
  type ProductId,
  type ReportWeek,
  type Result,
  type SourceOutcome,
  type SourceResult,
  type WeeklyReport,
  type Workspace,
} from "@nuvantre/domain";
import type {
  AnalyticsConnectionRepository,
  BriefRepository,
  Clock,
  IdGenerator,
  MetricsSource,
  ProductRepository,
  SubscriptionRepository,
  WeeklyReportAnalyst,
  WeeklyReportRepository,
  WorkspaceRepository,
} from "@nuvantre/ports";
import { failure, type UseCaseError } from "./errors";
import type { MetricsSourceRegistry } from "./metrics-source-registry";
import { ensureActive, loadActiveProduct } from "./active-product";

/** Builds, annotates and saves one product's report for one week. Shared by the use cases below. */
export class WeeklyReportBuilder {
  constructor(
    private readonly deps: {
      readonly briefs: BriefRepository;
      readonly metricsSources: MetricsSourceRegistry;
      readonly analyst: WeeklyReportAnalyst;
      readonly weeklyReports: WeeklyReportRepository;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async build(product: Product, week: ReportWeek): Promise<WeeklyReport> {
    const results = await Promise.all(
      this.deps.metricsSources.all().map((source) => this.read(source, product.id, week)),
    );
    const existing = await this.deps.weeklyReports.findByProductAndWeek(product.id, weekKey(week));
    const report = buildWeeklyReport({
      // Rebuilding a week replaces its report in place, so links to it keep working.
      id: existing?.id ?? weeklyReportId(this.deps.ids.next()),
      productId: product.id,
      week,
      results,
      now: this.deps.clock.now(),
    });
    const brief = await this.deps.briefs.findLatestForProduct(product.id);
    const analysis = await this.deps.analyst.analyse({
      product: { name: product.name },
      brief: brief?.status === "approved" ? brief.content : null,
      report,
    });
    const annotated = analysis.ok
      ? withAnalystNotes(report, analysis.value)
      : withoutAnalystNotes(report, analysis.error.message);
    await this.deps.weeklyReports.save(annotated);
    return annotated;
  }

  private async read(source: MetricsSource, productId: ProductId, week: ReportWeek) {
    const before = previousWeek(week);
    const [current, previous] = await Promise.all([
      source.fetch({ productId, from: week.start, to: week.end }),
      source.fetch({ productId, from: before.start, to: before.end }),
    ]);
    const outcome: SourceOutcome = current.ok
      ? { kind: "ok", current: current.value, previous: previous.ok ? previous.value : null }
      : current.error.code === "not_connected"
        ? { kind: "not_connected" }
        : { kind: "failed", reason: current.error.message };
    return { source: source.source, outcome } satisfies SourceResult;
  }
}

/** "Build report now": the latest complete week, rebuilt if it already exists. */
export class GenerateWeeklyReport {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly subscriptions: SubscriptionRepository;
      readonly workspaces: WorkspaceRepository;
      readonly analyticsConnections: AnalyticsConnectionRepository;
      readonly builder: WeeklyReportBuilder;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<Result<WeeklyReport, UseCaseError>> {
    const product = await loadActiveProduct(this.deps, input.workspace, input.productId);
    if (!product.ok) return product;
    const connections = await this.deps.analyticsConnections.listByProduct(product.value.id);
    if (connections.length === 0) {
      return err(failure("analytics_not_connected", "Connect Google or Plausible first"));
    }
    return ok(
      await this.deps.builder.build(product.value, lastCompleteWeek(this.deps.clock.now())),
    );
  }
}

const SETTLE_MS = 6 * 60 * 60 * 1000;
const MAX_PER_RUN = 20;

/**
 * The weekly job: last week's report for every connected product that lacks one. It waits until
 * Monday 06:00 UTC so sources have finished the week, and catches up on any later run.
 */
export class BuildDueReports {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly subscriptions: SubscriptionRepository;
      readonly workspaces: WorkspaceRepository;
      readonly analyticsConnections: AnalyticsConnectionRepository;
      readonly weeklyReports: WeeklyReportRepository;
      readonly builder: WeeklyReportBuilder;
      readonly clock: Clock;
    },
  ) {}

  async execute(): Promise<{
    built: number;
    skipped: number;
    /** The reports built by this run, for the weekly report emails. */
    reports: readonly WeeklyReport[];
  }> {
    const now = this.deps.clock.now();
    const week = lastCompleteWeek(now);
    if (now.getTime() < week.end.getTime() + SETTLE_MS)
      return { built: 0, skipped: 0, reports: [] };
    let built = 0;
    let skipped = 0;
    const reports: WeeklyReport[] = [];
    for (const id of await this.deps.analyticsConnections.listConnectedProductIds()) {
      if (await this.deps.weeklyReports.findByProductAndWeek(id, weekKey(week))) {
        skipped += 1;
        continue;
      }
      if (built >= MAX_PER_RUN) continue;
      const product = await this.deps.products.findById(id);
      if (!product) continue;
      if (!(await ensureActive(this.deps, product)).ok) {
        skipped += 1;
        continue;
      }
      reports.push(await this.deps.builder.build(product, week));
      built += 1;
    }
    return { built, skipped, reports };
  }
}
