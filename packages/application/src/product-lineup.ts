import {
  archiveProduct,
  err,
  ok,
  restoreProduct,
  standingOf,
  swapSlots,
  type Plan,
  type Product,
  type ProductId,
  type Result,
  type SlotAllocation,
  type Workspace,
} from "@nuvantre/domain";
import { workspaceSlots, type SlotDeps } from "./active-product";
import { failure, type UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

export type ProductLineup = SlotAllocation & { readonly plan: Plan };

/** The workspace's products as the plan sees them: active, paused and archived. */
export class GetProductLineup {
  constructor(private readonly deps: SlotDeps) {}

  async execute(workspace: Workspace): Promise<ProductLineup> {
    const { plan, allocation } = await workspaceSlots(this.deps, workspace.id);
    return { plan, ...allocation };
  }
}

/** Puts a product aside: its data stays, it frees a slot and stops drafting and publishing. */
export class ArchiveProduct {
  constructor(private readonly deps: SlotDeps) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<Result<Product, UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const archived = archiveProduct(product.value, this.deps.clock.now());
    await this.deps.products.save(archived);
    return ok(archived);
  }
}

/** Brings an archived product back when the plan has a free slot. */
export class RestoreProduct {
  constructor(private readonly deps: SlotDeps) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<Result<Product, UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const { plan, allocation } = await workspaceSlots(this.deps, input.workspace.id);
    const restored = restoreProduct(product.value, allocation, plan, this.deps.clock.now());
    if (restored.ok) await this.deps.products.save(restored.value);
    return restored;
  }
}

/** Makes a paused product active in place of an active one, which is paused instead. */
export class SwapActiveProduct {
  constructor(private readonly deps: SlotDeps) {}

  async execute(input: {
    workspace: Workspace;
    activate: ProductId;
    pause: ProductId;
  }): Promise<Result<readonly [Product, Product], UseCaseError>> {
    const activate = await loadOwnedProduct(this.deps.products, input.workspace, input.activate);
    if (!activate.ok) return activate;
    const pause = await loadOwnedProduct(this.deps.products, input.workspace, input.pause);
    if (!pause.ok) return pause;
    const { allocation } = await workspaceSlots(this.deps, input.workspace.id);
    if (
      standingOf(activate.value.id, allocation) !== "paused" ||
      standingOf(pause.value.id, allocation) !== "active"
    ) {
      return err(
        failure("invalid_swap", "Choose a paused product to make active in place of an active one"),
      );
    }
    const swapped = swapSlots(activate.value, pause.value);
    await Promise.all(swapped.map((product) => this.deps.products.save(product)));
    return ok(swapped);
  }
}
