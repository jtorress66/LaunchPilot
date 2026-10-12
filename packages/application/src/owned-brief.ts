import {
  err,
  ok,
  type Brief,
  type ProductId,
  type Result,
  type Workspace,
} from "@launchpilot/domain";
import type { BriefRepository, ProductRepository } from "@launchpilot/ports";
import { failure, type UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

/** The latest brief of a product the workspace owns. */
export const loadOwnedBrief = async (
  deps: { readonly products: ProductRepository; readonly briefs: BriefRepository },
  workspace: Workspace,
  productId: ProductId,
): Promise<Result<Brief, UseCaseError>> => {
  const product = await loadOwnedProduct(deps.products, workspace, productId);
  if (!product.ok) return product;
  const brief = await deps.briefs.findLatestForProduct(product.value.id);
  return brief
    ? ok(brief)
    : err(failure("brief_not_found", "Draft a brief for this product first"));
};
