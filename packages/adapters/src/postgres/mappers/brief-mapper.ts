import {
  briefId,
  briefStatuses,
  productId,
  userId,
  type Brief,
  type BriefContent,
} from "@nuvantre/domain";
import type { BriefRow } from "../schema";
import { oneOf, readJson, toJson } from "./columns";

export const briefMapper = {
  toRow: (brief: Brief): BriefRow => ({
    id: brief.id,
    product_id: brief.productId,
    version: brief.version,
    status: brief.status,
    content: toJson(brief.content),
    approved_by: brief.approval?.by ?? null,
    approved_at: brief.approval?.at ?? null,
    updated_at: brief.updatedAt,
  }),
  fromRow: (row: BriefRow): Brief => ({
    id: briefId(row.id),
    productId: productId(row.product_id),
    version: row.version,
    status: oneOf(briefStatuses, row.status, "briefs.status"),
    // Written only by toRow from a validated BriefContent.
    content: readJson(row.content) as BriefContent,
    approval:
      row.approved_by !== null && row.approved_at !== null
        ? { by: userId(row.approved_by), at: row.approved_at }
        : null,
    updatedAt: row.updated_at,
  }),
};
