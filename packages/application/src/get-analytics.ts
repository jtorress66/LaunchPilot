import {
  err,
  ok,
  type Product,
  type ProductId,
  type ReportWeek,
  type Result,
  type WeeklyReport,
  type Workspace,
} from "@launchpilot/domain";
import type {
  AnalyticsConnectionRepository,
  ProductRepository,
  WeeklyReportRepository,
} from "@launchpilot/ports";
import { failure, type UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

export interface AnalyticsOverview {
  readonly product: Product;
  /** What the founder sees of each connection; secrets never leave the repository. */
  readonly google: {
    readonly accountEmail: string;
    readonly searchConsoleSite: string | null;
    readonly ga4PropertyId: string | null;
  } | null;
  readonly plausible: { readonly siteId: string; readonly baseUrl: string } | null;
  readonly reports: readonly {
    readonly weekKey: string;
    readonly week: ReportWeek;
    readonly builtAt: Date;
  }[];
  readonly latest: WeeklyReport | null;
}

export class GetAnalyticsOverview {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly analyticsConnections: AnalyticsConnectionRepository;
      readonly weeklyReports: WeeklyReportRepository;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<Result<AnalyticsOverview, UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const [google, plausible, reports] = await Promise.all([
      this.deps.analyticsConnections.find(product.value.id, "google"),
      this.deps.analyticsConnections.find(product.value.id, "plausible"),
      this.deps.weeklyReports.listByProduct(product.value.id),
    ]);
    return ok({
      product: product.value,
      google: google
        ? {
            accountEmail: google.accountEmail,
            searchConsoleSite: google.searchConsoleSite,
            ga4PropertyId: google.ga4PropertyId,
          }
        : null,
      plausible: plausible ? { siteId: plausible.siteId, baseUrl: plausible.baseUrl } : null,
      reports: reports.map(({ weekKey, week, builtAt }) => ({ weekKey, week, builtAt })),
      latest: reports[0] ?? null,
    });
  }
}

export class GetWeeklyReport {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly weeklyReports: WeeklyReportRepository;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
    weekKey: string;
  }): Promise<Result<{ product: Product; report: WeeklyReport }, UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const report = await this.deps.weeklyReports.findByProductAndWeek(
      product.value.id,
      input.weekKey,
    );
    return report
      ? ok({ product: product.value, report })
      : err(failure("report_not_found", "There is no report for that week"));
  }
}
