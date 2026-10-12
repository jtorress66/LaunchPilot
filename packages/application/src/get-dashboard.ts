import {
  type BriefStatus,
  effectivePlan,
  startOfUtcMonth,
  plans,
  type Plan,
  type Product,
  type SubscriptionStatus,
  type Workspace,
} from "@launchpilot/domain";
import type {
  BriefRepository,
  Clock,
  ContentItemRepository,
  ProductRepository,
  SubscriptionRepository,
} from "@launchpilot/ports";
import { loadSubscription } from "./current-plan";

export interface Dashboard {
  readonly workspace: Workspace;
  readonly products: readonly Product[];
  readonly plan: Plan;
  readonly subscriptionStatus: SubscriptionStatus;
  readonly usage: { readonly products: number; readonly contentItemsThisMonth: number };
  readonly canAddProduct: boolean;
  /** Brief status per product id; "none" until a brief is drafted. */
  readonly briefStatus: Readonly<Record<string, BriefStatus | "none">>;
}

export class GetDashboard {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly briefs: BriefRepository;
      readonly contentItems: ContentItemRepository;
      readonly subscriptions: SubscriptionRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(workspace: Workspace): Promise<Dashboard> {
    const products = await this.deps.products.listByWorkspace(workspace.id);
    const subscription = await loadSubscription(this.deps, workspace);
    const plan = plans[effectivePlan(subscription, this.deps.clock.now())];
    const statuses = await Promise.all(
      products.map(async (product) => {
        const brief = await this.deps.briefs.findLatestForProduct(product.id);
        return [product.id, brief?.status ?? "none"] as const;
      }),
    );
    return {
      workspace,
      products,
      plan,
      subscriptionStatus: subscription.status,
      usage: {
        products: products.length,
        contentItemsThisMonth: await this.deps.contentItems.countCreatedSince(
          products.map((p) => p.id),
          startOfUtcMonth(this.deps.clock.now()),
        ),
      },
      canAddProduct: products.length < plan.limits.products,
      briefStatus: Object.fromEntries(statuses),
    };
  }
}
