import {
  toPublishable,
  transition,
  type ContentItem,
  type ContentItemEvent,
} from "@launchpilot/domain";
import type { Clock, ContentItemRepository, TaskRepository } from "@launchpilot/ports";
import { completeTaskOf } from "./complete-task";
import type { PublisherRegistry } from "./publisher-registry";

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 3;

/** Counts only: the job's log never includes post text, URLs or secrets. */
export interface PublishRunSummary {
  readonly published: number;
  readonly retrying: number;
  readonly failed: number;
}

type Outcome = keyof PublishRunSummary;

/**
 * The scheduler's job: publishes scheduled posts whose time has come, earliest first.
 * Only founder-approved items reach a publisher (`toPublishable`). A temporary failure keeps
 * the post scheduled for the next run, up to 3 attempts; anything else marks it failed so
 * the founder can see why and retry.
 */
export class PublishDueContent {
  constructor(
    private readonly deps: {
      readonly contentItems: ContentItemRepository;
      readonly tasks: TaskRepository;
      readonly publishers: PublisherRegistry;
      readonly clock: Clock;
    },
  ) {}

  async execute(): Promise<PublishRunSummary> {
    const now = this.deps.clock.now();
    const due = (await this.deps.contentItems.listByStatus("scheduled"))
      .filter((item) => item.publishAt !== null && item.publishAt.getTime() <= now.getTime())
      .sort((a, b) => (a.publishAt?.getTime() ?? 0) - (b.publishAt?.getTime() ?? 0))
      .slice(0, BATCH_SIZE);
    const summary = { published: 0, retrying: 0, failed: 0 };
    for (const item of due) summary[await this.publishOne(item)] += 1;
    return summary;
  }

  private async publishOne(item: ContentItem): Promise<Outcome> {
    const publishable = toPublishable(item);
    if (!publishable.ok) return this.fail(item, publishable.error.message);
    const publisher = await this.deps.publishers.forProduct(item.channel, item.productId);
    if (!publisher.ok) return this.fail(item, publisher.error.message);
    const receipt = await publisher.value.publish(publishable.value);
    if (receipt.ok) {
      await this.record(item, { type: "markPublished", externalUrl: receipt.value.externalUrl });
      await completeTaskOf(this.deps.tasks, item);
      return "published";
    }
    if (receipt.error.retryable && item.publishAttempts + 1 < MAX_ATTEMPTS) {
      await this.record(item, { type: "recordPublishAttempt" });
      return "retrying";
    }
    return this.fail(item, receipt.error.message);
  }

  private async fail(item: ContentItem, reason: string): Promise<Outcome> {
    await this.record(item, { type: "markFailed", reason });
    return "failed";
  }

  private async record(item: ContentItem, event: ContentItemEvent): Promise<void> {
    const next = transition(item, event, { now: this.deps.clock.now() });
    if (next.ok) await this.deps.contentItems.save(next.value);
  }
}
