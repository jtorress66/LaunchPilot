import { parseHttpUrl, productId, workspaceId, type Product } from "@launchpilot/domain";
import type { ProductRow } from "../schema";

export const productMapper = {
  toRow: (product: Product): ProductRow => ({
    id: product.id,
    workspace_id: product.workspaceId,
    name: product.name,
    url: product.url,
    created_at: product.createdAt,
  }),
  fromRow: (row: ProductRow): Product => {
    const url = parseHttpUrl(row.url);
    if (!url.ok) throw new Error(`Unexpected value "${row.url}" in products.url`);
    return {
      id: productId(row.id),
      workspaceId: workspaceId(row.workspace_id),
      name: row.name,
      url: url.value,
      createdAt: row.created_at,
    };
  },
};
