import { err, ok, type BriefContent, type ProductId, type Result } from "@nuvantre/domain";
import type { BriefRepository } from "@nuvantre/ports";
import { failure, type UseCaseError } from "./errors";

/** Agents work only from a brief the founder approved: it holds the only facts they may state. */
export const loadApprovedBrief = async (
  briefs: BriefRepository,
  productId: ProductId,
): Promise<Result<BriefContent, UseCaseError>> => {
  const brief = await briefs.findLatestForProduct(productId);
  return brief?.status === "approved"
    ? ok(brief.content)
    : err(failure("brief_not_approved", "Approve the Product Brief first"));
};
