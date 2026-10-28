import {
  toPublishable,
  transition,
  type ContentItem,
  type ContentItemId,
  type Result,
} from "@nuvantre/domain";
import type {
  Clock,
  ContentItemRepository,
  ProductRepository,
  PublishError,
  SubscriptionRepository,
  TaskRepository,
  WorkspaceRepository,
} from "@nuvantre/ports";
import { ensureActive } from "./active-product";
import { founderOfAccess, recordAudit, type AuditDeps } from "./audit";
import type { UseCaseError } from "./errors";
import { completeTaskOf } from "./complete-task";
import { loadOwnedItem } from "./owned-content";
import type { PublisherRegistry } from "./publisher-registry";
import { authorize, type WorkspaceAccess } from "./workspace-access";

/**
 * Publishes an approved item through its channel's publisher. `toPublishable` lets only
 * founder-approved items on auto-publish channels through. A failed attempt leaves the
 * item approved, so the founder can simply try again.
 */
export class PublishContentItem {
  constructor(
    private readonly deps: {
      readonly contentItems: ContentItemRepository;
      readonly products: ProductRepository;
      readonly subscriptions: SubscriptionRepository;
      readonly workspaces: WorkspaceRepository;
      readonly tasks: TaskRepository;
      readonly publishers: PublisherRegistry;
      readonly clock: Clock;
    } & AuditDeps,
  ) {}

  async execute(input: {
    access: WorkspaceAccess;
    itemId: ContentItemId;
  }): Promise<Result<ContentItem, UseCaseError | PublishError>> {
    const allowed = authorize(input.access, "publish");
    if (!allowed.ok) return allowed;
    const { workspace } = input.access;
    const owned = await loadOwnedItem(this.deps, workspace, input.itemId);
    if (!owned.ok) return owned;
    const { item, product } = owned.value;
    const active = await ensureActive(this.deps, product);
    if (!active.ok) return active;
    const publishable = toPublishable(item);
    if (!publishable.ok) return publishable;
    const publisher = await this.deps.publishers.forProduct(item.channel, item.productId);
    if (!publisher.ok) return publisher;
    const receipt = await publisher.value.publish(publishable.value);
    if (!receipt.ok) return receipt;

    const published = transition(
      item,
      { type: "markPublished", externalUrl: receipt.value.externalUrl },
      { now: this.deps.clock.now() },
    );
    if (!published.ok) return published;
    await this.deps.contentItems.save(published.value);
    await completeTaskOf(this.deps.tasks, item);
    await recordAudit(this.deps, {
      workspaceId: workspace.id,
      actor: founderOfAccess(input.access),
      action: "content_published",
      subject: { kind: "content", id: item.id, label: item.title },
    });
    return published;
  }
}
