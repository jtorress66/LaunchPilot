import {
  checkCanCreateProduct,
  createProduct,
  productId,
  type Product,
  type Result,
  type Workspace,
} from "@launchpilot/domain";
import type {
  Clock,
  IdGenerator,
  ProductRepository,
  SubscriptionRepository,
} from "@launchpilot/ports";
import { currentPlan } from "./current-plan";
import type { UseCaseError } from "./errors";

export interface CreateProductDeps {
  readonly products: ProductRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/** Adds a product to the workspace, within the limits of its current plan. */
export class CreateProduct {
  constructor(private readonly deps: CreateProductDeps) {}

  async execute(input: {
    workspace: Workspace;
    name: string;
    url: string;
  }): Promise<Result<Product, UseCaseError>> {
    const existing = await this.deps.products.listByWorkspace(input.workspace.id);
    const allowed = checkCanCreateProduct(
      await currentPlan(this.deps, input.workspace),
      existing.length,
    );
    if (!allowed.ok) return allowed;
    const product = createProduct({
      id: productId(this.deps.ids.next()),
      workspaceId: input.workspace.id,
      name: input.name,
      url: input.url,
      now: this.deps.clock.now(),
    });
    if (product.ok) await this.deps.products.save(product.value);
    return product;
  }
}
