import {
  setProductLocale,
  type Product,
  type ProductId,
  type Result,
  type Workspace,
} from "@nuvantre/domain";
import type { ProductRepository } from "@nuvantre/ports";
import type { UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

/** The founder picks the language and market the product's articles and posts are written for. */
export class SetProductLocale {
  constructor(private readonly deps: { readonly products: ProductRepository }) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
    locale: string;
  }): Promise<Result<Product, UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const updated = setProductLocale(product.value, input.locale);
    if (updated.ok) await this.deps.products.save(updated.value);
    return updated;
  }
}
