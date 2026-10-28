import {
  transition,
  type ContentItem,
  type ContentItemEvent,
  type ContentItemId,
  type Result,
} from "@nuvantre/domain";
import type {
  Clock,
  ContentItemRepository,
  ProductRepository,
  SubscriptionRepository,
  WorkspaceRepository,
} from "@nuvantre/ports";
import { ensureActive } from "./active-product";
import { founderOfAccess, recordAudit, type AuditDeps } from "./audit";
import type { UseCaseError } from "./errors";
import { loadOwnedItem } from "./owned-content";
import { authorize, type WorkspaceAccess } from "./workspace-access";

interface Deps extends AuditDeps {
  readonly contentItems: ContentItemRepository;
  readonly products: ProductRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly workspaces: WorkspaceRepository;
  readonly clock: Clock;
}

const apply = async (
  deps: Deps,
  access: WorkspaceAccess,
  itemId: ContentItemId,
  event: ContentItemEvent,
): Promise<Result<ContentItem, UseCaseError>> => {
  const allowed = authorize(access, "publish");
  if (!allowed.ok) return allowed;
  const { workspace } = access;
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
      actor: founderOfAccess(access),
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
    access: WorkspaceAccess;
    itemId: ContentItemId;
    publishAt: Date;
  }): Promise<Result<ContentItem, UseCaseError>> {
    return apply(this.deps, input.access, input.itemId, {
      type: "schedule",
      publishAt: input.publishAt,
    });
  }
}

/** Takes a scheduled post off the calendar; it stays approved. */
export class UnschedulePost {
  constructor(private readonly deps: Deps) {}

  execute(input: {
    access: WorkspaceAccess;
    itemId: ContentItemId;
  }): Promise<Result<ContentItem, UseCaseError>> {
    return apply(this.deps, input.access, input.itemId, { type: "unschedule" });
  }
}
