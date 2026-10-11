import {
  effectivePlan,
  plans,
  type Plan,
  type Product,
  type SubscriptionStatus,
  type Workspace,
} from "@launchpilot/domain";
import type { Clock, ProductRepository, SubscriptionRepository } from "@launchpilot/ports";
import { loadSubscription } from "./current-plan";

export interface Dashboard {
  readonly workspace: Workspace;
  readonly products: readonly Product[];
  readonly plan: Plan;
  readonly subscriptionStatus: SubscriptionStatus;
  readonly usage: { readonly products: number };
  readonly canAddProduct: boolean;
}

export class GetDashboard {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly subscriptions: SubscriptionRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(workspace: Workspace): Promise<Dashboard> {
    const products = await this.deps.products.listByWorkspace(workspace.id);
    const subscription = await loadSubscription(this.deps, workspace);
    const plan = plans[effectivePlan(subscription, this.deps.clock.now())];
    return {
      workspace,
      products,
      plan,
      subscriptionStatus: subscription.status,
      usage: { products: products.length },
      canAddProduct: products.length < plan.limits.products,
    };
  }
}
