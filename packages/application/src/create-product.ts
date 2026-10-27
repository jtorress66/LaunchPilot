import {
  checkCanCreateProduct,
  createProduct,
  slotsInUse,
  productId,
  type Product,
  type Result,
  type Workspace,
} from "@nuvantre/domain";
import type {
  Clock,
  IdGenerator,
  ProductRepository,
  SubscriptionRepository,
} from "@nuvantre/ports";
import { founderOf, recordAudit, type AuditDeps } from "./audit";
import { currentPlan } from "./current-plan";
import type { UseCaseError } from "./errors";

export interface CreateProductDeps extends AuditDeps {
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
      slotsInUse(existing),
    );
    if (!allowed.ok) return allowed;
    const product = createProduct({
      id: productId(this.deps.ids.next()),
      workspaceId: input.workspace.id,
      name: input.name,
      url: input.url,
      now: this.deps.clock.now(),
    });
    if (!product.ok) return product;
    await this.deps.products.save(product.value);
    await recordAudit(this.deps, {
      workspaceId: input.workspace.id,
      actor: founderOf(input.workspace),
      action: "product_created",
      subject: { kind: "product", id: product.value.id, label: product.value.name },
    });
    return product;
  }
}
