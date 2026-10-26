import {
  checkCanCreateContent,
  plans,
  startOfUtcMonth,
  type DomainError,
  type Result,
  type Workspace,
} from "@nuvantre/domain";
import type {
  Clock,
  ContentItemRepository,
  ProductRepository,
  SubscriptionRepository,
} from "@nuvantre/ports";
import { currentPlan } from "./current-plan";

/** Whether the workspace may draft `needed` more content items this month under its plan. */
export const checkContentAllowance = async (
  deps: {
    readonly products: ProductRepository;
    readonly contentItems: ContentItemRepository;
    readonly subscriptions: SubscriptionRepository;
    readonly clock: Clock;
  },
  workspace: Workspace,
  needed = 1,
): Promise<Result<null, DomainError>> => {
  const products = await deps.products.listByWorkspace(workspace.id);
  const used = await deps.contentItems.countCreatedSince(
    products.map((p) => p.id),
    startOfUtcMonth(deps.clock.now()),
  );
  return checkCanCreateContent(await currentPlan(deps, workspace), used + needed - 1);
};

/** How many more content items the workspace's plan allows this month (never negative). */
export const remainingContentAllowance = async (
  deps: {
    readonly products: ProductRepository;
    readonly contentItems: ContentItemRepository;
    readonly subscriptions: SubscriptionRepository;
    readonly clock: Clock;
  },
  workspace: Workspace,
): Promise<number> => {
  const products = await deps.products.listByWorkspace(workspace.id);
  const used = await deps.contentItems.countCreatedSince(
    products.map((p) => p.id),
    startOfUtcMonth(deps.clock.now()),
  );
  const plan = await currentPlan(deps, workspace);
  return Math.max(0, plans[plan].limits.contentItemsPerMonth - used);
};
