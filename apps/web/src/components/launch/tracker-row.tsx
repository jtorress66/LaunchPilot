"use client";

import type { TrackerRow as Row } from "@nuvantre/application";
import type { SubmissionStatus } from "@nuvantre/domain";
import { useActionState } from "react";
import {
  markLiveAction,
  moveSubmissionAction,
  rejectSubmissionAction,
  type LaunchActionState,
} from "../../app/_lib/launch-actions";
import { FormError } from "../forms/form-error";
import { CopyButton } from "./copy-button";

const statusLabels: Record<SubmissionStatus, string> = {
  planned: "Planned",
  submitted: "Submitted",
  live: "Live",
  rejected: "Rejected",
  skipped: "Skipped",
};

const small =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800";
const input =
  "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900";

function Move({
  productId,
  rowId,
  type,
  children,
}: {
  readonly productId: string;
  readonly rowId: string;
  readonly type: "submit" | "skip" | "reopen";
  readonly children: string;
}) {
  const [state, action] = useActionState<LaunchActionState>(
    moveSubmissionAction.bind(null, productId, rowId, type),
    {},
  );
  return (
    <form action={action}>
      <button type="submit" className={small}>
        {children}
      </button>
      <FormError message={state.errors?.form} />
    </form>
  );
}

function TextAction({
  action: serverAction,
  productId,
  rowId,
  name,
  label,
  button,
}: {
  readonly action: typeof markLiveAction;
  readonly productId: string;
  readonly rowId: string;
  readonly name: string;
  readonly label: string;
  readonly button: string;
}) {
  const [state, action] = useActionState<LaunchActionState, FormData>(
    serverAction.bind(null, productId, rowId),
    {},
  );
  const id = `${rowId}-${name}`;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2" noValidate>
      <div className="space-y-1">
        <label htmlFor={id} className="block text-xs font-medium">
          {label}
        </label>
        <input id={id} name={name} className={input} />
      </div>
      <button type="submit" className={small}>
        {button}
      </button>
      <FormError message={state.errors?.[name] ?? state.errors?.form} />
    </form>
  );
}

export function TrackerRow({ productId, row }: { readonly productId: string; readonly row: Row }) {
  const { submission, directory, fitted, warnings, followUp } = row;
  return (
    <li aria-label={directory.name} className="space-y-3 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{directory.name}</span>
        <span
          data-testid="submission-status"
          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold dark:bg-slate-800"
        >
          {statusLabels[submission.status]}
        </span>
        {followUp ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            Follow up
          </span>
        ) : null}
        <a
          href={directory.submitUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-brand-600 hover:underline"
        >
          Open submit page
        </a>
      </div>
      {submission.live ? (
        <p className="text-sm">
          Listing:{" "}
          <a
            href={submission.live.listingUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline"
          >
            {submission.live.listingUrl}
          </a>
        </p>
      ) : null}
      {submission.rejection ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Rejected: {submission.rejection.reason}
        </p>
      ) : null}
      {warnings.map((warning) => (
        <p key={warning} role="note" className="text-sm text-amber-700 dark:text-amber-300">
          {warning}
        </p>
      ))}
      {fitted && directory.kind !== "community" ? (
        <div className="flex flex-wrap gap-2">
          <CopyButton text={fitted.name} label="name" />
          <CopyButton text={fitted.tagline} label="tagline" />
          <CopyButton text={fitted.shortDescription} label="short description" />
          <CopyButton text={fitted.longDescription} label="long description" />
          <CopyButton text={fitted.features.join("\n")} label="features" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-start gap-3">
        {submission.status === "planned" ? (
          <>
            <Move productId={productId} rowId={submission.id} type="submit">
              Mark submitted
            </Move>
            <Move productId={productId} rowId={submission.id} type="skip">
              Skip
            </Move>
          </>
        ) : null}
        {submission.status === "submitted" ? (
          <>
            <TextAction
              action={markLiveAction}
              productId={productId}
              rowId={submission.id}
              name="listingUrl"
              label="Listing URL"
              button="Mark live"
            />
            <TextAction
              action={rejectSubmissionAction}
              productId={productId}
              rowId={submission.id}
              name="reason"
              label="Rejection reason"
              button="Mark rejected"
            />
          </>
        ) : null}
        {submission.status === "rejected" || submission.status === "skipped" ? (
          <Move productId={productId} rowId={submission.id} type="reopen">
            Reopen
          </Move>
        ) : null}
      </div>
    </li>
  );
}
