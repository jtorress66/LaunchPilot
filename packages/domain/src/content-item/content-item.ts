import { isAutoPublishable, type Channel } from "../channels/channel";
import { andThen, err, map, ok, type Result } from "../result";
import type { Actor } from "../shared/actor";
import { domainError, type DomainError } from "../shared/errors";
import type { Brand, ContentItemId, ProductId, TaskId, UserId } from "../shared/ids";
import { applyTransition, defineTransitions } from "../shared/state-machine";
import { nonEmptyText } from "../shared/text";
import { parseHttpUrl, type HttpUrl } from "../shared/url";

export const contentItemStatuses = [
  "draft",
  "in_review",
  "approved",
  "rejected",
  "scheduled",
  "published",
  "failed",
  "archived",
] as const;

export type ContentItemStatus = (typeof contentItemStatuses)[number];

export interface ContentItem {
  readonly id: ContentItemId;
  readonly productId: ProductId;
  readonly taskId: TaskId;
  readonly channel: Channel;
  readonly title: string;
  readonly body: string;
  readonly status: ContentItemStatus;
  /** Bumped on every edit so reviewers know which revision they approved. */
  readonly version: number;
  readonly createdBy: Actor;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly reviewNote: string | null;
  readonly rejection: { readonly by: Actor; readonly reason: string; readonly at: Date } | null;
  readonly approval: { readonly by: UserId; readonly at: Date } | null;
  readonly publishAt: Date | null;
  readonly publication: { readonly externalUrl: HttpUrl; readonly at: Date } | null;
  readonly failure: { readonly reason: string; readonly at: Date } | null;
}

/** A founder-approved item on an API channel. The Publisher port accepts nothing else. */
export type PublishableContentItem = Brand<ContentItem, "PublishableContentItem">;

export type ContentItemEvent =
  | { readonly type: "submit" }
  | { readonly type: "requestChanges"; readonly actor: Actor; readonly note: string }
  | { readonly type: "approve"; readonly actor: Actor }
  | { readonly type: "reject"; readonly actor: Actor; readonly reason: string }
  | { readonly type: "edit"; readonly title?: string; readonly body?: string }
  | { readonly type: "schedule"; readonly publishAt: Date }
  | { readonly type: "unschedule" }
  | { readonly type: "markPublished"; readonly externalUrl: string }
  | { readonly type: "markFailed"; readonly reason: string }
  | { readonly type: "retry"; readonly publishAt: Date }
  | { readonly type: "archive" };

type EventType = ContentItemEvent["type"];

interface Context {
  readonly now: Date;
}

const machine = defineTransitions<ContentItemStatus, EventType>({
  draft: { submit: "in_review", edit: "draft", archive: "archived" },
  in_review: {
    requestChanges: "draft",
    edit: "draft",
    approve: "approved",
    reject: "rejected",
    archive: "archived",
  },
  approved: {
    schedule: "scheduled",
    markPublished: "published",
    edit: "draft",
    archive: "archived",
  },
  scheduled: {
    unschedule: "approved",
    markPublished: "published",
    markFailed: "failed",
    edit: "draft",
  },
  failed: { retry: "scheduled", edit: "draft", archive: "archived" },
  rejected: { edit: "draft", archive: "archived" },
  published: {},
  archived: {},
});

/** Events that put content on a public channel; refused for draft-only channels. */
const publishingEvents: ReadonlySet<EventType> = new Set(["schedule", "markPublished", "retry"]);

const title = (value: string) => nonEmptyText(value, { field: "Title", max: 200 });
const body = (value: string) => nonEmptyText(value, { field: "Body", max: 100_000 });
const note = (value: string, field: string) => nonEmptyText(value, { field, max: 2000 });

const futureTime = (publishAt: Date, now: Date): Result<Date, DomainError> =>
  publishAt.getTime() < now.getTime()
    ? err(domainError("publish_time_in_past", "The publish time must not be in the past"))
    : ok(publishAt);

type Patch = Partial<Omit<ContentItem, "id" | "status">>;
type Handler<K extends EventType> = (
  item: ContentItem,
  event: Extract<ContentItemEvent, { type: K }>,
  ctx: Context,
) => Result<Patch, DomainError>;

/** What each event changes besides the status. Guards live next to the data they protect. */
const handlers: { readonly [K in EventType]: Handler<K> } = {
  submit: () => ok({ reviewNote: null }),
  requestChanges: (_item, event) =>
    map(note(event.note, "Review note"), (reviewNote) => ({ reviewNote })),
  approve: (_item, event, { now }) =>
    event.actor.kind === "founder"
      ? ok({ approval: { by: event.actor.userId, at: now } })
      : err(domainError("approval_requires_founder", "Only the founder can approve content")),
  reject: (_item, event, { now }) =>
    map(note(event.reason, "Rejection reason"), (reason) => ({
      rejection: { by: event.actor, reason, at: now },
    })),
  // Any edit invalidates approval, schedule and earlier outcomes: the new revision must be reviewed.
  edit: (item, event) =>
    andThen(title(event.title ?? item.title), (newTitle) =>
      map(body(event.body ?? item.body), (newBody) => ({
        title: newTitle,
        body: newBody,
        version: item.version + 1,
        approval: null,
        publishAt: null,
        rejection: null,
        failure: null,
      })),
    ),
  schedule: (_item, event, { now }) =>
    map(futureTime(event.publishAt, now), (publishAt) => ({ publishAt })),
  unschedule: () => ok({ publishAt: null }),
  markPublished: (_item, event, { now }) =>
    map(parseHttpUrl(event.externalUrl), (externalUrl) => ({
      publication: { externalUrl, at: now },
    })),
  markFailed: (_item, event, { now }) =>
    map(note(event.reason, "Failure reason"), (reason) => ({ failure: { reason, at: now } })),
  retry: (_item, event, { now }) =>
    map(futureTime(event.publishAt, now), (publishAt) => ({ publishAt, failure: null })),
  archive: () => ok({}),
};

const draftOnly = (channel: Channel) =>
  err(
    domainError(
      "channel_is_draft_only",
      `${channel} content is draft-only and is never published automatically`,
    ),
  );

export const createContentItem = (input: {
  id: ContentItemId;
  productId: ProductId;
  taskId: TaskId;
  channel: Channel;
  title: string;
  body: string;
  createdBy: Actor;
  now: Date;
}): Result<ContentItem, DomainError> =>
  andThen(title(input.title), (validTitle) =>
    map(body(input.body), (validBody) => ({
      id: input.id,
      productId: input.productId,
      taskId: input.taskId,
      channel: input.channel,
      title: validTitle,
      body: validBody,
      status: "draft" as const,
      version: 1,
      createdBy: input.createdBy,
      createdAt: input.now,
      updatedAt: input.now,
      reviewNote: null,
      rejection: null,
      approval: null,
      publishAt: null,
      publication: null,
      failure: null,
    })),
  );

/** Applies one event. Returns a new item; the original is never modified. */
export const transition = (
  item: ContentItem,
  event: ContentItemEvent,
  ctx: Context,
): Result<ContentItem, DomainError> =>
  andThen(applyTransition(machine, item.status, event.type), (status) => {
    if (publishingEvents.has(event.type) && !isAutoPublishable(item.channel)) {
      return draftOnly(item.channel);
    }
    // TypeScript cannot correlate `handlers[event.type]` with `event`; the mapped type guarantees it.
    const handler = handlers[event.type] as Handler<EventType>;
    return map(handler(item, event as never, ctx), (patch) => ({
      ...item,
      ...patch,
      status,
      updatedAt: ctx.now,
    }));
  });

/** The only way to obtain a PublishableContentItem: approved or scheduled, on an API channel. */
export const toPublishable = (item: ContentItem): Result<PublishableContentItem, DomainError> => {
  if (item.status !== "approved" && item.status !== "scheduled") {
    return err(domainError("not_publishable", `A ${item.status} item cannot be published`));
  }
  if (!isAutoPublishable(item.channel)) return draftOnly(item.channel);
  return ok(item as PublishableContentItem);
};
