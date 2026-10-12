import {
  transition,
  type Actor,
  type ContentItem,
  type ContentItemId,
  type Result,
  type Workspace,
} from "@launchpilot/domain";
import type { Clock, ContentItemRepository, ProductRepository } from "@launchpilot/ports";
import type { UseCaseError } from "./errors";
import { loadOwnedItem } from "./owned-content";

/** Records the founder's approval. Nothing is published without it. */
export class ApproveContentItem {
  constructor(
    private readonly deps: {
      readonly contentItems: ContentItemRepository;
      readonly products: ProductRepository;
      readonly clock: Clock;
    },
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
    if (approved.ok) await this.deps.contentItems.save(approved.value);
    return approved;
  }
}
