"use client";

import { maxLengthOf, type ContentItemStatus, type SocialChannel } from "@nuvantre/domain";
import { useActionState, useState } from "react";
import { approveArticleAction, type ContentActionState } from "../../app/_lib/content-actions";
import {
  publishPostAction,
  savePostAction,
  schedulePostAction,
  unschedulePostAction,
  type SocialActionState,
} from "../../app/_lib/social-actions";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";
import { channelName } from "../social/channel-name";

interface PostEditorProps {
  readonly itemId: string;
  readonly channel: SocialChannel;
  readonly body: string;
  readonly status: ContentItemStatus;
  readonly justSaved: boolean;
}

const EDITABLE: readonly ContentItemStatus[] = [
  "draft",
  "in_review",
  "approved",
  "rejected",
  "failed",
];
const card =
  "space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900";
const button =
  "inline-flex items-center justify-center rounded-lg px-4 py-2.5 font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50";

export function PostEditor({ itemId, channel, body, status, justSaved }: PostEditorProps) {
  const [saveState, save] = useActionState<SocialActionState, FormData>(
    savePostAction.bind(null, itemId),
    {},
  );
  const [approveState, approve] = useActionState<ContentActionState>(
    approveArticleAction.bind(null, itemId),
    {},
  );
  const [publishState, publish] = useActionState<SocialActionState>(
    publishPostAction.bind(null, itemId),
    {},
  );
  const [scheduleState, schedule] = useActionState<SocialActionState, FormData>(
    schedulePostAction.bind(null, itemId),
    {},
  );
  const [unscheduleState, unschedule] = useActionState<SocialActionState>(
    unschedulePostAction.bind(null, itemId),
    {},
  );
  const [text, setText] = useState(body);
  const [tzOffset, setTzOffset] = useState("0");
  const dirty = text !== body;
  const limit = maxLengthOf(channel);
  const over = text.length > limit;

  return (
    <div className="space-y-6">
      {EDITABLE.includes(status) ? (
        <form action={save} className={card} noValidate>
          {status === "approved" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Saving changes sends the post back for your approval.
            </p>
          ) : null}
          <div className="space-y-1.5">
            <label htmlFor="body" className="block text-sm font-medium">
              {channelName(channel)} post
            </label>
            <textarea
              id="body"
              name="body"
              rows={channel === "x" ? 5 : 12}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
              aria-invalid={over || saveState.errors?.body ? true : undefined}
              aria-describedby="body-count"
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 aria-invalid:border-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <p
              id="body-count"
              aria-live="polite"
              className={`text-xs ${over ? "font-semibold text-red-600 dark:text-red-400" : "text-slate-500"}`}
            >
              {text.length} / {limit} characters
            </p>
            {saveState.errors?.body ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {saveState.errors.body}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-40">
              <SubmitButton pending="Saving…">Save changes</SubmitButton>
            </div>
            {justSaved && !dirty ? (
              <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
                Saved.
              </p>
            ) : null}
          </div>
        </form>
      ) : null}

      <section className={card}>
        <h2 className="font-semibold">Approve and publish</h2>
        {dirty ? <p className="text-sm text-slate-500">Save your changes first.</p> : null}
        <FormError
          message={
            approveState.errors?.form ?? publishState.errors?.form ?? unscheduleState.errors?.form
          }
        />
        <div className="flex flex-wrap gap-3">
          <form action={approve}>
            <button
              type="submit"
              disabled={dirty || status !== "in_review"}
              className={`${button} bg-emerald-600 hover:bg-emerald-700`}
            >
              Approve post
            </button>
          </form>
          <form action={publish}>
            <button
              type="submit"
              disabled={dirty || status !== "approved"}
              className={`${button} bg-brand-600 hover:bg-brand-700`}
            >
              Publish now
            </button>
          </form>
          {status === "scheduled" ? (
            <form action={unschedule}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Unschedule
              </button>
            </form>
          ) : null}
        </div>

        {status === "approved" && !dirty ? (
          <form action={schedule} className="flex flex-wrap items-end gap-3" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="publishAt" className="block text-sm font-medium">
                Schedule for
              </label>
              <input
                id="publishAt"
                name="publishAt"
                type="datetime-local"
                onChange={(event) => {
                  // The offset for the chosen moment, so daylight saving is handled.
                  const chosen = new Date(event.target.value);
                  setTzOffset(String(chosen.getTimezoneOffset()));
                }}
                aria-invalid={scheduleState.errors?.publishAt ? true : undefined}
                className="block rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <input type="hidden" name="tzOffset" value={tzOffset} />
            <div className="w-32">
              <SubmitButton pending="Scheduling…">Schedule</SubmitButton>
            </div>
            <FormError message={scheduleState.errors?.publishAt ?? scheduleState.errors?.form} />
          </form>
        ) : null}
        <p className="text-xs text-slate-500">
          Nothing is posted until you approve it. Posts go out through Zernio to the{" "}
          {channelName(channel)} account you linked.
        </p>
      </section>
    </div>
  );
}
