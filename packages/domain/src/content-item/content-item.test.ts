import { describe, expect, it } from "vitest";
import type { Channel } from "../channels/channel";
import type { Actor } from "../shared/actor";
import { contentItemId, productId, taskId, userId } from "../shared/ids";
import {
  contentItemStatuses,
  createContentItem,
  toPublishable,
  transition,
  type ContentItem,
  type ContentItemEvent,
  type ContentItemStatus,
} from "./content-item";

const t0 = new Date("2026-03-01T09:00:00.000Z");
const later = new Date("2026-03-02T09:00:00.000Z");
const earlier = new Date("2026-02-28T09:00:00.000Z");
const ctx = { now: t0 };
const founder: Actor = { kind: "founder", userId: userId("user_1") };
const reviewer: Actor = { kind: "agent", agent: "reviewer" };

const draft = (channel: Channel = "blog"): ContentItem => {
  const result = createContentItem({
    id: contentItemId("item_1"),
    productId: productId("prod_1"),
    taskId: taskId("task_1"),
    channel,
    title: "  Launch week recap ",
    body: "We shipped three features.",
    createdBy: { kind: "agent", agent: "seo" },
    now: t0,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

const apply = (item: ContentItem, ...events: ContentItemEvent[]): ContentItem =>
  events.reduce((current, event) => {
    const next = transition(current, event, ctx);
    if (!next.ok) throw new Error(`${event.type}: ${next.error.message}`);
    return next.value;
  }, item);

const events = {
  submit: { type: "submit" },
  requestChanges: { type: "requestChanges", actor: reviewer, note: "Add a pricing link" },
  approve: { type: "approve", actor: founder },
  reject: { type: "reject", actor: founder, reason: "Off-brand" },
  edit: { type: "edit", body: "We shipped four features." },
  schedule: { type: "schedule", publishAt: later },
  unschedule: { type: "unschedule" },
  markPublished: { type: "markPublished", externalUrl: "https://acme.dev/blog/recap" },
  markFailed: { type: "markFailed", reason: "API timeout" },
  retry: { type: "retry", publishAt: later },
  archive: { type: "archive" },
  recordPublishAttempt: { type: "recordPublishAttempt" },
} as const satisfies Record<ContentItemEvent["type"], ContentItemEvent>;

/** Shortest path from a fresh draft to each status, using a publishable channel. */
const pathTo: Record<ContentItemStatus, ContentItemEvent[]> = {
  draft: [],
  in_review: [events.submit],
  approved: [events.submit, events.approve],
  rejected: [events.submit, events.reject],
  scheduled: [events.submit, events.approve, events.schedule],
  published: [events.submit, events.approve, events.markPublished],
  failed: [events.submit, events.approve, events.schedule, events.markFailed],
  archived: [events.archive],
};

const allowed: Record<
  ContentItemStatus,
  Partial<Record<ContentItemEvent["type"], ContentItemStatus>>
> = {
  draft: { submit: "in_review", edit: "draft", archive: "archived" },
  in_review: {
    requestChanges: "draft",
    // The founder may edit a draft that is waiting for their review.
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
    // The worker counts failed attempts so it can give up after a few.
    recordPublishAttempt: "scheduled",
  },
  failed: { retry: "scheduled", edit: "draft", archive: "archived" },
  rejected: { edit: "draft", archive: "archived" },
  published: {},
  archived: {},
};

const matrix = contentItemStatuses.flatMap((status) =>
  Object.values(events).map((event) => ({ status, event, expected: allowed[status][event.type] })),
);
const allowedPairs = matrix.filter((pair) => pair.expected !== undefined);
const refusedPairs = matrix.filter((pair) => pair.expected === undefined);

describe("ContentItem state machine", () => {
  describe("transition matrix", () => {
    it.each(allowedPairs)("$status + $event.type → $expected", ({ status, event, expected }) => {
      const result = transition(apply(draft(), ...pathTo[status]), event, ctx);
      expect(result.ok && result.value.status).toBe(expected);
    });

    it.each(refusedPairs)("$status + $event.type is refused", ({ status, event }) => {
      expect(transition(apply(draft(), ...pathTo[status]), event, ctx)).toEqual({
        ok: false,
        error: { code: "invalid_transition", message: `Cannot "${event.type}" from "${status}"` },
      });
    });

    it("covers every status and event", () => {
      expect(allowedPairs.length + refusedPairs.length).toBe(
        contentItemStatuses.length * Object.keys(events).length,
      );
    });
  });

  describe("creation", () => {
    it("creates a trimmed draft at version 1 with no review history", () => {
      expect(draft()).toEqual({
        id: "item_1",
        productId: "prod_1",
        taskId: "task_1",
        channel: "blog",
        title: "Launch week recap",
        body: "We shipped three features.",
        status: "draft",
        version: 1,
        createdBy: { kind: "agent", agent: "seo" },
        createdAt: t0,
        updatedAt: t0,
        reviewNote: null,
        rejection: null,
        approval: null,
        publishAt: null,
        publication: null,
        failure: null,
        publishAttempts: 0,
      });
    });

    it("rejects an empty title", () => {
      const result = createContentItem({
        id: contentItemId("item_1"),
        productId: productId("prod_1"),
        taskId: taskId("task_1"),
        channel: "blog",
        title: " ",
        body: "Body",
        createdBy: founder,
        now: t0,
      });
      expect(result.ok ? undefined : result.error.code).toBe("invalid_text");
    });

    it("rejects an empty body", () => {
      const result = createContentItem({
        id: contentItemId("item_1"),
        productId: productId("prod_1"),
        taskId: taskId("task_1"),
        channel: "blog",
        title: "Title",
        body: "",
        createdBy: founder,
        now: t0,
      });
      expect(result.ok ? undefined : result.error.code).toBe("invalid_text");
    });
  });

  describe("review and approval", () => {
    it("records the founder and time on approval", () => {
      const at = new Date("2026-03-01T10:00:00.000Z");
      const result = transition(apply(draft(), events.submit), events.approve, { now: at });
      expect(result).toMatchObject({
        ok: true,
        value: { status: "approved", approval: { by: "user_1", at }, updatedAt: at },
      });
    });

    it("refuses approval from an agent so nothing ships without the founder", () => {
      const result = transition(
        apply(draft(), events.submit),
        { type: "approve", actor: reviewer },
        ctx,
      );
      expect(result).toEqual({
        ok: false,
        error: {
          code: "approval_requires_founder",
          message: "Only the founder can approve content",
        },
      });
    });

    it("returns to draft with the reviewer's note when changes are requested", () => {
      const item = apply(draft(), events.submit, events.requestChanges);
      expect(item).toMatchObject({ status: "draft", reviewNote: "Add a pricing link" });
    });

    it("clears the review note once the draft is resubmitted", () => {
      const item = apply(draft(), events.submit, events.requestChanges, events.submit);
      expect(item.reviewNote).toBeNull();
    });

    it("rejects a change request without a note", () => {
      const result = transition(
        apply(draft(), events.submit),
        { type: "requestChanges", actor: reviewer, note: " " },
        ctx,
      );
      expect(result.ok ? undefined : result.error.code).toBe("invalid_text");
    });

    it("records who rejected the item and why", () => {
      const item = apply(draft(), events.submit, events.reject);
      expect(item.rejection).toEqual({ by: founder, reason: "Off-brand", at: t0 });
    });

    it("rejects a rejection without a reason", () => {
      const result = transition(
        apply(draft(), events.submit),
        { type: "reject", actor: founder, reason: "" },
        ctx,
      );
      expect(result.ok ? undefined : result.error.code).toBe("invalid_text");
    });
  });

  describe("editing", () => {
    it("updates a draft's title and body and bumps the version", () => {
      const item = apply(draft(), { type: "edit", title: "New title", body: "New body" });
      expect(item).toMatchObject({ title: "New title", body: "New body", version: 2 });
    });

    it("keeps fields that the edit does not mention", () => {
      const item = apply(draft(), { type: "edit", title: "Only the title" });
      expect(item).toMatchObject({ title: "Only the title", body: "We shipped three features." });
    });

    it("rejects an edit that blanks the body", () => {
      const result = transition(draft(), { type: "edit", body: "  " }, ctx);
      expect(result.ok ? undefined : result.error.code).toBe("invalid_text");
    });

    it("rejects an edit that blanks the title", () => {
      const result = transition(draft(), { type: "edit", title: "" }, ctx);
      expect(result.ok ? undefined : result.error.code).toBe("invalid_text");
    });

    it("returns an approved item to draft and clears the approval", () => {
      const item = apply(draft(), ...pathTo.approved, events.edit);
      expect(item).toMatchObject({ status: "draft", approval: null, version: 2 });
    });

    it("cancels the schedule and clears the approval when a scheduled item is edited", () => {
      const item = apply(draft(), ...pathTo.scheduled, events.edit);
      expect(item).toMatchObject({ status: "draft", approval: null, publishAt: null });
    });

    it("clears an earlier rejection and failure when the item is reworked", () => {
      expect(apply(draft(), ...pathTo.rejected, events.edit).rejection).toBeNull();
      expect(apply(draft(), ...pathTo.failed, events.edit).failure).toBeNull();
    });
  });

  describe("scheduling and publishing", () => {
    it("schedules an approved item for a future time", () => {
      const item = apply(draft(), ...pathTo.scheduled);
      expect(item).toMatchObject({ status: "scheduled", publishAt: later });
    });

    it("rejects scheduling in the past", () => {
      const result = transition(
        apply(draft(), ...pathTo.approved),
        { type: "schedule", publishAt: earlier },
        ctx,
      );
      expect(result.ok ? undefined : result.error.code).toBe("publish_time_in_past");
    });

    it("unscheduling keeps the approval but drops the publish time", () => {
      const item = apply(draft(), ...pathTo.scheduled, events.unschedule);
      expect(item).toMatchObject({
        status: "approved",
        publishAt: null,
        approval: { by: "user_1" },
      });
    });

    it("publishes an approved item immediately and records where and when", () => {
      const item = apply(draft(), ...pathTo.published);
      expect(item).toMatchObject({
        status: "published",
        publication: { externalUrl: "https://acme.dev/blog/recap", at: t0 },
      });
    });

    it("publishes a scheduled item", () => {
      const item = apply(draft(), ...pathTo.scheduled, events.markPublished);
      expect(item.status).toBe("published");
    });

    it("rejects a publication without a valid http(s) URL", () => {
      const result = transition(
        apply(draft(), ...pathTo.approved),
        { type: "markPublished", externalUrl: "not a url" },
        ctx,
      );
      expect(result.ok ? undefined : result.error.code).toBe("invalid_url");
    });

    it("records a failed publish and allows a retry at a new time", () => {
      const failed = apply(draft(), ...pathTo.failed);
      expect(failed.failure).toEqual({ reason: "API timeout", at: t0 });
      const retried = apply(failed, events.retry);
      expect(retried).toMatchObject({ status: "scheduled", publishAt: later, failure: null });
    });

    it("rejects a failure without a reason", () => {
      const result = transition(
        apply(draft(), ...pathTo.scheduled),
        { type: "markFailed", reason: "" },
        ctx,
      );
      expect(result.ok ? undefined : result.error.code).toBe("invalid_text");
    });

    it("rejects retrying in the past", () => {
      const result = transition(
        apply(draft(), ...pathTo.failed),
        { type: "retry", publishAt: earlier },
        ctx,
      );
      expect(result.ok ? undefined : result.error.code).toBe("publish_time_in_past");
    });
  });

  describe.each(["reddit", "hackernews", "indiehackers", "producthunt", "directory"] as const)(
    "%s (never auto-published)",
    (channel) => {
      const approved = () => apply(draft(channel), events.submit, events.approve);

      it("can be drafted and approved for the founder to post by hand", () => {
        expect(approved().status).toBe("approved");
      });

      it.each([events.schedule, events.markPublished])("refuses $type", (event) => {
        expect(transition(approved(), event, ctx)).toEqual({
          ok: false,
          error: {
            code: "channel_is_draft_only",
            message: `${channel} content is draft-only and is never published automatically`,
          },
        });
      });
    },
  );

  it("never mutates the item it was given", () => {
    const original = draft();
    const snapshot = structuredClone(original);
    apply(original, events.submit, events.approve);
    expect(original).toEqual(snapshot);
  });

  describe("toPublishable", () => {
    it.each(["approved", "scheduled"] as const)("accepts a %s item on an API channel", (status) => {
      const item = apply(draft(), ...pathTo[status]);
      expect(toPublishable(item)).toEqual({ ok: true, value: item });
    });

    it.each(["draft", "in_review", "rejected", "published", "failed", "archived"] as const)(
      "refuses a %s item",
      (status) => {
        const result = toPublishable(apply(draft(), ...pathTo[status]));
        expect(result).toEqual({
          ok: false,
          error: { code: "not_publishable", message: `A ${status} item cannot be published` },
        });
      },
    );

    it("refuses an approved item on a draft-only channel", () => {
      const result = toPublishable(apply(draft("reddit"), events.submit, events.approve));
      expect(result.ok ? undefined : result.error.code).toBe("channel_is_draft_only");
    });
  });
});

describe("channel length limits", () => {
  const create = (channel: Channel, body: string) =>
    createContentItem({
      id: contentItemId("item_1"),
      productId: productId("prod_1"),
      taskId: taskId("task_1"),
      channel,
      title: "Post",
      body,
      createdBy: { kind: "agent", agent: "social" },
      now: t0,
    });

  it("accepts an X post of exactly 280 characters and refuses a longer one", () => {
    expect(create("x", "a".repeat(280)).ok).toBe(true);
    expect(create("x", "a".repeat(281))).toEqual({
      ok: false,
      error: { code: "invalid_text", message: "Body must be at most 280 characters" },
    });
  });

  it("applies the channel's limit to edits too", () => {
    const post = apply(draft("x"), events.submit);
    const result = transition(post, { type: "edit", body: "b".repeat(281) }, ctx);
    expect(result.ok ? undefined : result.error.message).toBe(
      "Body must be at most 280 characters",
    );
    expect(transition(post, { type: "edit", body: "b".repeat(280) }, ctx).ok).toBe(true);
  });
});

describe("publish attempts", () => {
  it("start at zero and count each failed attempt while scheduled", () => {
    const scheduled = apply(draft("x"), ...pathTo.scheduled);
    expect(scheduled.publishAttempts).toBe(0);
    expect(
      apply(scheduled, events.recordPublishAttempt, events.recordPublishAttempt),
    ).toMatchObject({
      status: "scheduled",
      publishAttempts: 2,
    });
  });

  it("reset when the founder retries or edits", () => {
    const tried = apply(draft("x"), ...pathTo.scheduled, events.recordPublishAttempt);
    expect(apply(tried, events.markFailed, events.retry).publishAttempts).toBe(0);
    expect(apply(tried, events.edit).publishAttempts).toBe(0);
  });
});
