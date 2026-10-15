import { err, map, ok, type Result } from "../result";
import { domainError, type DomainError } from "../shared/errors";
import type { ProductId, SubmissionId } from "../shared/ids";
import { applyTransition, defineTransitions } from "../shared/state-machine";
import { nonEmptyText } from "../shared/text";
import { parseHttpUrl, type HttpUrl } from "../shared/url";

export const submissionStatuses = ["planned", "submitted", "live", "rejected", "skipped"] as const;
export type SubmissionStatus = (typeof submissionStatuses)[number];

/** One directory in a product's launch. The founder submits by hand; this only tracks it. */
export interface Submission {
  readonly id: SubmissionId;
  readonly productId: ProductId;
  readonly directorySlug: string;
  readonly status: SubmissionStatus;
  readonly submittedAt: Date | null;
  readonly live: { readonly listingUrl: HttpUrl; readonly at: Date } | null;
  readonly rejection: { readonly reason: string; readonly at: Date } | null;
  readonly updatedAt: Date;
}

export type SubmissionEvent =
  | { readonly type: "submit" }
  | { readonly type: "markLive"; readonly listingUrl: string }
  | { readonly type: "reject"; readonly reason: string }
  | { readonly type: "skip" }
  | { readonly type: "reopen" };

export interface SubmissionContext {
  readonly now: Date;
  /** Nothing is submitted before the founder approves the launch kit. */
  readonly kitApproved: boolean;
  /** For communities: whether the founder approved the post they will make there. */
  readonly communityDraftApproved?: boolean;
}

const machine = defineTransitions<SubmissionStatus, SubmissionEvent["type"]>({
  planned: { submit: "submitted", skip: "skipped" },
  submitted: { markLive: "live", reject: "rejected", skip: "skipped" },
  live: {},
  rejected: { reopen: "planned" },
  skipped: { reopen: "planned" },
});

type Patch = Partial<Omit<Submission, "id" | "status">>;

const submitGuard = (ctx: SubmissionContext): Result<Patch, DomainError> => {
  if (!ctx.kitApproved) {
    return err(domainError("launch_kit_not_approved", "Approve the launch kit before submitting"));
  }
  if (ctx.communityDraftApproved === false) {
    return err(
      domainError(
        "community_draft_not_approved",
        "Approve the draft post for this community first",
      ),
    );
  }
  return ok({ submittedAt: ctx.now });
};

const patchFor = (event: SubmissionEvent, ctx: SubmissionContext): Result<Patch, DomainError> => {
  switch (event.type) {
    case "submit":
      return submitGuard(ctx);
    case "markLive":
      return map(parseHttpUrl(event.listingUrl), (listingUrl) => ({
        live: { listingUrl, at: ctx.now },
      }));
    case "reject":
      return map(nonEmptyText(event.reason, { field: "Rejection reason", max: 500 }), (reason) => ({
        rejection: { reason, at: ctx.now },
      }));
    case "skip":
      return ok({});
    case "reopen":
      return ok({ submittedAt: null, live: null, rejection: null });
  }
};

export const createSubmission = (input: {
  id: SubmissionId;
  productId: ProductId;
  directorySlug: string;
  now: Date;
}): Submission => ({
  id: input.id,
  productId: input.productId,
  directorySlug: input.directorySlug,
  status: "planned",
  submittedAt: null,
  live: null,
  rejection: null,
  updatedAt: input.now,
});

/** Applies one event; returns a new submission. */
export const transitionSubmission = (
  submission: Submission,
  event: SubmissionEvent,
  ctx: SubmissionContext,
): Result<Submission, DomainError> => {
  const status = applyTransition(machine, submission.status, event.type);
  if (!status.ok) return status;
  return map(patchFor(event, ctx), (patch) => ({
    ...submission,
    ...patch,
    status: status.value,
    updatedAt: ctx.now,
  }));
};

const FOLLOW_UP_MS = 14 * 24 * 60 * 60 * 1000;

/** A submission still waiting for an answer two weeks later deserves a nudge. */
export const needsFollowUp = (submission: Submission, now: Date): boolean =>
  submission.status === "submitted" &&
  submission.submittedAt !== null &&
  now.getTime() - submission.submittedAt.getTime() > FOLLOW_UP_MS;
