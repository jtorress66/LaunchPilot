import {
  toPublishable,
  transition,
  transitionTask,
  type ContentItem,
  type ContentItemId,
  type Result,
  type Workspace,
} from "@launchpilot/domain";
import type {
  Clock,
  ContentItemRepository,
  ProductRepository,
  PublishError,
  TaskRepository,
} from "@launchpilot/ports";
import type { UseCaseError } from "./errors";
import { loadOwnedItem } from "./owned-content";
import type { PublisherRegistry } from "./publisher-registry";

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
      readonly tasks: TaskRepository;
      readonly publishers: PublisherRegistry;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    itemId: ContentItemId;
  }): Promise<Result<ContentItem, UseCaseError | PublishError>> {
    const owned = await loadOwnedItem(this.deps, input.workspace, input.itemId);
    if (!owned.ok) return owned;
    const { item } = owned.value;
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
    await this.completeTask(item);
    return published;
  }

  private async completeTask(item: ContentItem): Promise<void> {
    const task = await this.deps.tasks.findById(item.taskId);
    if (task?.status !== "in_progress") return;
    const done = transitionTask(task, "complete");
    if (done.ok) await this.deps.tasks.save(done.value);
  }
}
