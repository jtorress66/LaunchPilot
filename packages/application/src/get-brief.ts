import {
  ok,
  type Brief,
  type Product,
  type ProductId,
  type Result,
  type Workspace,
} from "@launchpilot/domain";
import type { BriefRepository, ProductRepository } from "@launchpilot/ports";
import type { UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

export interface ProductBrief {
  readonly product: Product;
  readonly brief: Brief | undefined;
}

export class GetBrief {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly briefs: BriefRepository;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<Result<ProductBrief, UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const brief = await this.deps.briefs.findLatestForProduct(product.value.id);
    return ok({ product: product.value, brief });
  }
}
