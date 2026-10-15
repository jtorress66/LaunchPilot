import { describe, expect, it } from "vitest";
import { productId, submissionId } from "../shared/ids";
import {
  createSubmission,
  needsFollowUp,
  submissionStatuses,
  transitionSubmission,
  type Submission,
  type SubmissionEvent,
  type SubmissionStatus,
} from "./submission";

const t0 = new Date("2026-10-15T09:00:00.000Z");
const later = new Date("2026-10-16T09:00:00.000Z");
const ready = { kitApproved: true };
const ctx = { now: later, ...ready };

const planned = (): Submission =>
  createSubmission({
    id: submissionId("sub_1"),
    productId: productId("prod_1"),
    directorySlug: "betalist",
    now: t0,
  });

const events: Record<SubmissionEvent["type"], SubmissionEvent> = {
  submit: { type: "submit" },
  markLive: { type: "markLive", listingUrl: "https://betalist.com/startups/acme" },
  reject: { type: "reject", reason: "Not a fit for our audience" },
  skip: { type: "skip" },
  reopen: { type: "reopen" },
};

const apply = (submission: Submission, ...list: SubmissionEvent[]) =>
  list.reduce((current, event) => {
    const next = transitionSubmission(current, event, ctx);
    if (!next.ok) throw new Error(next.error.message);
    return next.value;
  }, submission);

const pathTo: Record<SubmissionStatus, SubmissionEvent[]> = {
  planned: [],
  submitted: [events.submit],
  live: [events.submit, events.markLive],
  rejected: [events.submit, events.reject],
  skipped: [events.skip],
};

const allowed: Record<
  SubmissionStatus,
  Partial<Record<SubmissionEvent["type"], SubmissionStatus>>
> = {
  planned: { submit: "submitted", skip: "skipped" },
  submitted: { markLive: "live", reject: "rejected", skip: "skipped" },
  live: {},
  rejected: { reopen: "planned" },
  skipped: { reopen: "planned" },
};

describe("submission tracker", () => {
  it("starts planned", () => {
    expect(planned()).toEqual({
      id: "sub_1",
      productId: "prod_1",
      directorySlug: "betalist",
      status: "planned",
      submittedAt: null,
      live: null,
      rejection: null,
      updatedAt: t0,
    });
  });

  describe.each(submissionStatuses)("from %s", (status) => {
    it.each(Object.values(events))("applies $type only where allowed", (event) => {
      const result = transitionSubmission(apply(planned(), ...pathTo[status]), event, ctx);
      expect(result.ok ? result.value.status : result.error.code).toBe(
        allowed[status][event.type] ?? "invalid_transition",
      );
    });
  });

  it("records when it was submitted, and the listing once live", () => {
    const live = apply(planned(), events.submit, events.markLive);
    expect(live).toMatchObject({
      submittedAt: later,
      live: { listingUrl: "https://betalist.com/startups/acme", at: later },
      updatedAt: later,
    });
  });

  it("refuses to submit until the launch kit is approved", () => {
    expect(
      transitionSubmission(planned(), events.submit, { now: later, kitApproved: false }),
    ).toMatchObject({ ok: false, error: { code: "launch_kit_not_approved" } });
  });

  it("refuses to submit to a community until its draft post is approved", () => {
    expect(
      transitionSubmission(planned(), events.submit, {
        now: later,
        kitApproved: true,
        communityDraftApproved: false,
      }),
    ).toMatchObject({ ok: false, error: { code: "community_draft_not_approved" } });
    expect(
      transitionSubmission(planned(), events.submit, {
        now: later,
        kitApproved: true,
        communityDraftApproved: true,
      }).ok,
    ).toBe(true);
  });

  it("needs an http(s) listing URL to go live and a reason to be rejected", () => {
    const submitted = apply(planned(), events.submit);
    expect(
      transitionSubmission(submitted, { type: "markLive", listingUrl: "betalist" }, ctx),
    ).toMatchObject({ ok: false, error: { code: "invalid_url" } });
    expect(transitionSubmission(submitted, { type: "reject", reason: " " }, ctx)).toMatchObject({
      ok: false,
      error: { code: "invalid_text" },
    });
  });

  it("records the rejection reason and clears it when reopened", () => {
    const rejected = apply(planned(), events.submit, events.reject);
    expect(rejected.rejection).toEqual({ reason: "Not a fit for our audience", at: later });
    expect(apply(rejected, events.reopen)).toMatchObject({
      status: "planned",
      submittedAt: null,
      rejection: null,
    });
  });
});

describe("needsFollowUp", () => {
  const submitted = () => apply(planned(), events.submit);
  const days = (n: number) => new Date(later.getTime() + n * 24 * 60 * 60 * 1000);

  it("flags a submission still waiting after 14 days", () => {
    expect(needsFollowUp(submitted(), days(14))).toBe(false);
    expect(needsFollowUp(submitted(), days(15))).toBe(true);
  });

  it("never flags one that is not waiting", () => {
    expect(needsFollowUp(planned(), days(30))).toBe(false);
    expect(needsFollowUp(apply(planned(), events.submit, events.markLive), days(30))).toBe(false);
  });
});
