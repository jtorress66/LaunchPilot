import {
  formatLocale,
  parseContentLocale,
  parseHttpUrl,
  productId,
  workspaceId,
  type Product,
} from "@nuvantre/domain";
import type { ProductRow } from "../schema";

export const productMapper = {
  toRow: (product: Product): ProductRow => ({
    id: product.id,
    workspace_id: product.workspaceId,
    name: product.name,
    url: product.url,
    created_at: product.createdAt,
    autopilot_since: product.autopilotSince,
    locale: formatLocale(product.locale),
    archived_at: product.archivedAt,
    slot_order: product.slotOrder,
  }),
  fromRow: (row: ProductRow): Product => {
    const url = parseHttpUrl(row.url);
    if (!url.ok) throw new Error(`Unexpected value "${row.url}" in products.url`);
    const locale = parseContentLocale(row.locale);
    if (!locale.ok) throw new Error(`Unexpected value "${row.locale}" in products.locale`);
    return {
      id: productId(row.id),
      workspaceId: workspaceId(row.workspace_id),
      name: row.name,
      url: url.value,
      createdAt: row.created_at,
      autopilotSince: row.autopilot_since,
      locale: locale.value,
      archivedAt: row.archived_at,
      slotOrder: row.slot_order,
    };
  },
};
