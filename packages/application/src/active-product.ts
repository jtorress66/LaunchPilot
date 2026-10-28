import {
  allocateSlots,
  checkProductActive,
  ok,
  plans,
  type Plan,
  type Product,
  type ProductId,
  type Result,
  type SlotAllocation,
  type Workspace,
  type WorkspaceId,
} from "@nuvantre/domain";
import type { ProductRepository } from "@nuvantre/ports";
import { currentPlan, type PlanDeps } from "./current-plan";
import type { UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

export interface SlotDeps extends PlanDeps {
  readonly products: ProductRepository;
}

/** The workspace's plan and which of its products may work under it, as of now. */
export const workspaceSlots = async (
  deps: SlotDeps,
  workspaceId: WorkspaceId,
): Promise<{ readonly plan: Plan; readonly allocation: SlotAllocation }> => {
  const plan = plans[await currentPlan(deps, { id: workspaceId })];
  const allocation = allocateSlots(await deps.products.listByWorkspace(workspaceId), plan);
  return { plan, allocation };
};

/** Drafting, publishing and the weekly jobs only for active products; reading stays open. */
export const ensureActive = async (
  deps: SlotDeps,
  product: Product,
): Promise<Result<null, UseCaseError>> => {
  const { plan, allocation } = await workspaceSlots(deps, product.workspaceId);
  return checkProductActive(product, allocation, plan);
};

/** `loadOwnedProduct`, for work that only an active product may do. */
export const loadActiveProduct = async (
  deps: SlotDeps,
  workspace: Workspace,
  id: ProductId,
): Promise<Result<Product, UseCaseError>> => {
  const product = await loadOwnedProduct(deps.products, workspace, id);
  if (!product.ok) return product;
  const active = await ensureActive(deps, product.value);
  return active.ok ? ok(product.value) : active;
};
