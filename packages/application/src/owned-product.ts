import {
  err,
  ok,
  type Product,
  type ProductId,
  type Result,
  type Workspace,
} from "@nuvantre/domain";
import type { ProductRepository } from "@nuvantre/ports";
import { failure, type UseCaseError } from "./errors";

/** Loads a product only if it belongs to the workspace; another workspace's product looks missing. */
export const loadOwnedProduct = async (
  products: ProductRepository,
  workspace: Workspace,
  id: ProductId,
): Promise<Result<Product, UseCaseError>> => {
  const product = await products.findById(id);
  return product?.workspaceId === workspace.id
    ? ok(product)
    : err(failure("product_not_found", "This product does not exist"));
};
