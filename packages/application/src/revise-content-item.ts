import {
  andThen,
  transition,
  type ContentItem,
  type ContentItemId,
  type Result,
  type Workspace,
} from "@launchpilot/domain";
import type { Clock, ContentItemRepository, ProductRepository } from "@launchpilot/ports";
import type { UseCaseError } from "./errors";
import { loadOwnedItem } from "./owned-content";

/** The founder's edit. The new revision goes straight back to review and needs approval again. */
export class ReviseContentItem {
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
    title: string;
    body: string;
  }): Promise<Result<ContentItem, UseCaseError>> {
    const owned = await loadOwnedItem(this.deps, input.workspace, input.itemId);
    if (!owned.ok) return owned;
    const now = this.deps.clock.now();
    const revised = andThen(
      transition(owned.value.item, { type: "edit", title: input.title, body: input.body }, { now }),
      (edited) => transition(edited, { type: "submit" }, { now }),
    );
    if (revised.ok) await this.deps.contentItems.save(revised.value);
    return revised;
  }
}
