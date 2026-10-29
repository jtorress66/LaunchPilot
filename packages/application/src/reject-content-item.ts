import { transition, type ContentItem, type ContentItemId, type Result } from "@nuvantre/domain";
import type { Clock, ContentItemRepository, ProductRepository } from "@nuvantre/ports";
import { founderOfAccess, recordAudit, type AuditDeps } from "./audit";
import type { UseCaseError } from "./errors";
import { loadOwnedItem } from "./owned-content";
import { authorize, type WorkspaceAccess } from "./workspace-access";

const NO_REASON = "No reason given";

/** Records the founder's rejection. A rejected item can be reworked but never published as is. */
export class RejectContentItem {
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
    reason: string;
  }): Promise<Result<ContentItem, UseCaseError>> {
    const allowed = authorize(input.access, "approve");
    if (!allowed.ok) return allowed;
    const { workspace } = input.access;
    const actor = founderOfAccess(input.access);
    const owned = await loadOwnedItem(this.deps, workspace, input.itemId);
    if (!owned.ok) return owned;
    const rejected = transition(
      owned.value.item,
      { type: "reject", actor, reason: input.reason.trim() || NO_REASON },
      { now: this.deps.clock.now() },
    );
    if (!rejected.ok) return rejected;
    await this.deps.contentItems.save(rejected.value);
    await recordAudit(this.deps, {
      workspaceId: workspace.id,
      actor,
      action: "content_rejected",
      subject: { kind: "content", id: rejected.value.id, label: rejected.value.title },
    });
    return rejected;
  }
}
