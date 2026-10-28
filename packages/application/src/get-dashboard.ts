import {
  allocateSlots,
  plans,
  slotsInUse,
  startOfUtcMonth,
  type BriefStatus,
  type Plan,
  type Product,
  type ProductStanding,
  type SubscriptionStatus,
  type Workspace,
} from "@nuvantre/domain";
import type {
  BriefRepository,
  ChannelConnectionRepository,
  Clock,
  ContentItemRepository,
  ProductRepository,
  SubscriptionRepository,
  WeeklyReportRepository,
  WorkspaceRepository,
} from "@nuvantre/ports";
import { currentPlan, loadSubscription } from "./current-plan";

/** What is going on with one product, at a glance. */
export interface ProductCard {
  readonly product: Product;
  readonly standing: Exclude<ProductStanding, "archived">;
  /** "none" until a brief is drafted. */
  readonly briefStatus: BriefStatus | "none";
  readonly waitingForApproval: number;
  readonly scheduled: number;
  readonly publishedThisMonth: number;
  readonly blogConnected: boolean;
  /** Visitors in the latest weekly report, with the change on the week before; null without one. */
  readonly visitors: { readonly value: number; readonly change: number | null } | null;
}

export interface Dashboard {
  readonly workspace: Workspace;
  readonly plan: Plan;
  readonly subscriptionStatus: SubscriptionStatus;
  /** Archived products do not count against the plan. */
  readonly usage: { readonly products: number; readonly contentItemsThisMonth: number };
  readonly canAddProduct: boolean;
  /** Active products first, then paused ones, each in slot order. */
  readonly cards: readonly ProductCard[];
  readonly archived: readonly Product[];
}

export class GetDashboard {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly briefs: BriefRepository;
      readonly contentItems: ContentItemRepository;
      readonly subscriptions: SubscriptionRepository;
      readonly workspaces: WorkspaceRepository;
      readonly connections: ChannelConnectionRepository;
      readonly weeklyReports: WeeklyReportRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(workspace: Workspace): Promise<Dashboard> {
    const products = await this.deps.products.listByWorkspace(workspace.id);
    const subscription = await loadSubscription(this.deps, workspace);
    const now = this.deps.clock.now();
    const plan = plans[await currentPlan(this.deps, workspace)];
    const allocation = allocateSlots(products, plan);
    const ids = products.map((p) => p.id);
    const [byStatus, published] = await Promise.all([
      this.deps.contentItems.countByStatus(ids),
      this.deps.contentItems.countPublishedSince(ids, startOfUtcMonth(now)),
    ]);
    const countOf = (product: Product, status: "in_review" | "scheduled") =>
      byStatus.find((c) => c.productId === product.id && c.status === status)?.count ?? 0;

    const card = async (
      product: Product,
      standing: ProductCard["standing"],
    ): Promise<ProductCard> => {
      const [brief, blog, reports] = await Promise.all([
        this.deps.briefs.findLatestForProduct(product.id),
        this.deps.connections.findByProductAndChannel(product.id, "blog"),
        this.deps.weeklyReports.listByProduct(product.id),
      ]);
      const visitors = reports[0]?.metrics.find((m) => m.name === "visitors");
      return {
        product,
        standing,
        briefStatus: brief?.status ?? "none",
        waitingForApproval: countOf(product, "in_review"),
        scheduled: countOf(product, "scheduled"),
        publishedThisMonth: published.find((c) => c.productId === product.id)?.count ?? 0,
        blogConnected: blog !== undefined,
        visitors: visitors ? { value: visitors.value, change: visitors.change } : null,
      };
    };

    return {
      workspace,
      plan,
      subscriptionStatus: subscription.status,
      usage: {
        products: slotsInUse(products),
        contentItemsThisMonth: await this.deps.contentItems.countCreatedSince(
          ids,
          startOfUtcMonth(now),
        ),
      },
      canAddProduct: slotsInUse(products) < plan.limits.products,
      cards: await Promise.all([
        ...allocation.active.map((p) => card(p, "active")),
        ...allocation.paused.map((p) => card(p, "paused")),
      ]),
      archived: allocation.archived,
    };
  }
}
