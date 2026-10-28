import { transition, type ContentItem, type ContentItemId, type Result } from "@nuvantre/domain";
import type { Clock, ContentItemRepository, ProductRepository } from "@nuvantre/ports";
import { founderOfAccess, recordAudit, type AuditDeps } from "./audit";
import type { UseCaseError } from "./errors";
import { loadOwnedItem } from "./owned-content";
import { authorize, type WorkspaceAccess } from "./workspace-access";

/** Records the founder's approval. Nothing is published without it. */
export class ApproveContentItem {
  constructor(
    private readonly deps: {
      readonly contentItems: ContentItemRepository;
      readonly products: ProductRepository;
      readonly clock: Clock;
    } & AuditDeps,
  ) {}

  async execute(input: {
    access: WorkspaceAccess;
    itemId: ContentItemId;
  }): Promise<Result<ContentItem, UseCaseError>> {
    const allowed = authorize(input.access, "approve");
    if (!allowed.ok) return allowed;
    const { workspace } = input.access;
    const actor = founderOfAccess(input.access);
    const owned = await loadOwnedItem(this.deps, workspace, input.itemId);
    if (!owned.ok) return owned;
    const approved = transition(
      owned.value.item,
      { type: "approve", actor },
      { now: this.deps.clock.now() },
    );
    if (!approved.ok) return approved;
    await this.deps.contentItems.save(approved.value);
    await recordAudit(this.deps, {
      workspaceId: workspace.id,
      actor,
      action: "content_approved",
      subject: { kind: "content", id: approved.value.id, label: approved.value.title },
    });
    return approved;
  }
}
