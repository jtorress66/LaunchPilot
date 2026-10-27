import {
  andThen,
  transition,
  type ContentItem,
  type ContentItemId,
  type Result,
  type Workspace,
} from "@nuvantre/domain";
import type { Clock, ContentItemRepository, ProductRepository } from "@nuvantre/ports";
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
    /** Omitted for social posts, whose title is their planned angle. */
    title?: string;
    body: string;
    /** Blog articles only. */
    slug?: string;
    excerpt?: string;
  }): Promise<Result<ContentItem, UseCaseError>> {
    const owned = await loadOwnedItem(this.deps, input.workspace, input.itemId);
    if (!owned.ok) return owned;
    const now = this.deps.clock.now();
    const revised = andThen(
      transition(
        owned.value.item,
        {
          type: "edit",
          body: input.body,
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.slug === undefined ? {} : { slug: input.slug }),
          ...(input.excerpt === undefined ? {} : { excerpt: input.excerpt }),
        },
        { now },
      ),
      (edited) => transition(edited, { type: "submit" }, { now }),
    );
    if (revised.ok) await this.deps.contentItems.save(revised.value);
    return revised;
  }
}
