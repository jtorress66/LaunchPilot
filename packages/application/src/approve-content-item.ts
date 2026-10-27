import {
  transition,
  type Actor,
  type ContentItem,
  type ContentItemId,
  type Result,
  type Workspace,
} from "@nuvantre/domain";
import type { Clock, ContentItemRepository, ProductRepository } from "@nuvantre/ports";
import { recordAudit, type AuditDeps } from "./audit";
import type { UseCaseError } from "./errors";
import { loadOwnedItem } from "./owned-content";

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
    workspace: Workspace;
    itemId: ContentItemId;
    actor: Actor;
  }): Promise<Result<ContentItem, UseCaseError>> {
    const owned = await loadOwnedItem(this.deps, input.workspace, input.itemId);
    if (!owned.ok) return owned;
    const approved = transition(
      owned.value.item,
      { type: "approve", actor: input.actor },
      { now: this.deps.clock.now() },
    );
    if (!approved.ok) return approved;
    await this.deps.contentItems.save(approved.value);
    await recordAudit(this.deps, {
      workspaceId: input.workspace.id,
      actor: input.actor,
      action: "content_approved",
      subject: { kind: "content", id: approved.value.id, label: approved.value.title },
    });
    return approved;
  }
}
