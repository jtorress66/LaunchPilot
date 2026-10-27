import {
  transition,
  type ContentItem,
  type ContentItemEvent,
  type ContentItemId,
  type Result,
  type Workspace,
} from "@nuvantre/domain";
import type {
  Clock,
  ContentItemRepository,
  ProductRepository,
  SubscriptionRepository,
} from "@nuvantre/ports";
import { ensureActive } from "./active-product";
import { founderOf, recordAudit, type AuditDeps } from "./audit";
import type { UseCaseError } from "./errors";
import { loadOwnedItem } from "./owned-content";

interface Deps extends AuditDeps {
  readonly contentItems: ContentItemRepository;
  readonly products: ProductRepository;
  readonly subscriptions: SubscriptionRepository;
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
  // Taking a post off the calendar stays possible for a paused product; putting one on does not.
  if (event.type === "schedule") {
    const active = await ensureActive(deps, owned.value.product);
    if (!active.ok) return active;
  }
  const next = transition(owned.value.item, event, { now: deps.clock.now() });
  if (!next.ok) return next;
  await deps.contentItems.save(next.value);
  if (event.type === "schedule") {
    await recordAudit(deps, {
      workspaceId: workspace.id,
      actor: founderOf(workspace),
      action: "post_scheduled",
      subject: { kind: "content", id: next.value.id, label: next.value.title },
    });
  }
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
