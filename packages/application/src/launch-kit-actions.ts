import {
  approveLaunchKit,
  editLaunchKit,
  err,
  type Actor,
  type LaunchKit,
  type Listing,
  type ProductId,
  type Result,
  type Workspace,
} from "@nuvantre/domain";
import type { Clock, LaunchKitRepository, ProductRepository } from "@nuvantre/ports";
import { failure, type UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

interface Deps {
  readonly products: ProductRepository;
  readonly launchKits: LaunchKitRepository;
  readonly clock: Clock;
}

const loadKit = async (
  deps: Deps,
  workspace: Workspace,
  productId: ProductId,
): Promise<Result<LaunchKit, UseCaseError>> => {
  const product = await loadOwnedProduct(deps.products, workspace, productId);
  if (!product.ok) return product;
  const kit = await deps.launchKits.findLatestForProduct(product.value.id);
  return kit
    ? { ok: true, value: kit }
    : err(failure("launch_kit_not_found", "Generate the launch kit first"));
};

const saved = async (deps: Deps, result: Result<LaunchKit, UseCaseError>) => {
  if (result.ok) await deps.launchKits.save(result.value);
  return result;
};

/** The founder's edit. Any edit is a new version that needs approval again. */
export class ReviseLaunchKit {
  constructor(private readonly deps: Deps) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
    listing: Listing;
  }): Promise<Result<LaunchKit, UseCaseError>> {
    const kit = await loadKit(this.deps, input.workspace, input.productId);
    if (!kit.ok) return kit;
    return saved(
      this.deps,
      editLaunchKit(kit.value, input.listing, { now: this.deps.clock.now() }),
    );
  }
}

/** Records the founder's approval. Nothing is submitted anywhere before it. */
export class ApproveLaunchKit {
  constructor(private readonly deps: Deps) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
    actor: Actor;
  }): Promise<Result<LaunchKit, UseCaseError>> {
    const kit = await loadKit(this.deps, input.workspace, input.productId);
    if (!kit.ok) return kit;
    return saved(
      this.deps,
      approveLaunchKit(kit.value, input.actor, { now: this.deps.clock.now() }),
    );
  }
}
