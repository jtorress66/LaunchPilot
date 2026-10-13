import {
  checkCanCreateContent,
  startOfUtcMonth,
  type DomainError,
  type Result,
  type Workspace,
} from "@launchpilot/domain";
import type {
  Clock,
  ContentItemRepository,
  ProductRepository,
  SubscriptionRepository,
} from "@launchpilot/ports";
import { currentPlan } from "./current-plan";

/** Whether the workspace may draft one more content item this month under its plan. */
export const checkContentAllowance = async (
  deps: {
    readonly products: ProductRepository;
    readonly contentItems: ContentItemRepository;
    readonly subscriptions: SubscriptionRepository;
    readonly clock: Clock;
  },
  workspace: Workspace,
): Promise<Result<null, DomainError>> => {
  const products = await deps.products.listByWorkspace(workspace.id);
  const used = await deps.contentItems.countCreatedSince(
    products.map((p) => p.id),
    startOfUtcMonth(deps.clock.now()),
  );
  return checkCanCreateContent(await currentPlan(deps, workspace), used);
};
