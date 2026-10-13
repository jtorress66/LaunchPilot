import {
  transition,
  type ContentItem,
  type ContentItemEvent,
  type ContentItemId,
  type Result,
  type Workspace,
} from "@launchpilot/domain";
import type { Clock, ContentItemRepository, ProductRepository } from "@launchpilot/ports";
import type { UseCaseError } from "./errors";
import { loadOwnedItem } from "./owned-content";

interface Deps {
  readonly contentItems: ContentItemRepository;
  readonly products: ProductRepository;
  readonly clock: Clock;
}

const apply = async (
  deps: Deps,
  workspace: Workspace,
  itemId: ContentItemId,
  event: ContentItemEvent,
): Promise<Result<ContentItem, UseCaseError>> => {
  const owned = await loadOwnedItem(deps, workspace, itemId);
  if (!owned.ok) return owned;
  const next = transition(owned.value.item, event, { now: deps.clock.now() });
  if (next.ok) await deps.contentItems.save(next.value);
  return next;
};

/** Sets when an approved post goes out. The domain refuses unapproved posts and past times. */
export class SchedulePost {
  constructor(private readonly deps: Deps) {}

  execute(input: {
    workspace: Workspace;
    itemId: ContentItemId;
    publishAt: Date;
  }): Promise<Result<ContentItem, UseCaseError>> {
    return apply(this.deps, input.workspace, input.itemId, {
      type: "schedule",
      publishAt: input.publishAt,
    });
  }
}

/** Takes a scheduled post off the calendar; it stays approved. */
export class UnschedulePost {
  constructor(private readonly deps: Deps) {}

  execute(input: {
    workspace: Workspace;
    itemId: ContentItemId;
  }): Promise<Result<ContentItem, UseCaseError>> {
    return apply(this.deps, input.workspace, input.itemId, { type: "unschedule" });
  }
}
