"use client";

import type { CommunityChannel, ContentItemStatus } from "@launchpilot/domain";
import { useActionState, useState } from "react";
import {
  approveArticleAction,
  saveArticleAction,
  type ContentActionState,
} from "../../app/_lib/content-actions";
import { Field } from "../forms/field";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";
import { CopyButton } from "../launch/copy-button";
import { channelName } from "../social/channel-name";

/** Where the founder posts each community draft by hand. */
const postPages: Readonly<Record<CommunityChannel, string>> = {
  hackernews: "https://news.ycombinator.com/submit",
  reddit: "https://www.reddit.com/submit",
  indiehackers: "https://www.indiehackers.com",
};

const openLabels: Readonly<Record<CommunityChannel, string>> = {
  hackernews: "Open Show HN",
  reddit: "Open Reddit",
  indiehackers: "Open Indie Hackers",
};

const EDITABLE: readonly ContentItemStatus[] = ["draft", "in_review", "approved", "rejected"];

/**
 * A draft-only post: the founder edits, approves, then copies it and posts it themselves.
 * LaunchPilot never publishes it.
 */
export function CommunityPostEditor({
  itemId,
  channel,
  title,
  body,
  status,
  justSaved,
}: {
  readonly itemId: string;
  readonly channel: CommunityChannel;
  readonly title: string;
  readonly body: string;
  readonly status: ContentItemStatus;
  readonly justSaved: boolean;
}) {
  const [saveState, save] = useActionState<ContentActionState, FormData>(
    saveArticleAction.bind(null, itemId),
    {},
  );
  const [approveState, approve] = useActionState<ContentActionState>(
    approveArticleAction.bind(null, itemId),
    {},
  );
  const [dirty, setDirty] = useState(false);
  const errors = saveState.errors ?? {};
  const card =
    "space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900";

  return (
    <div className="space-y-6">
      {EDITABLE.includes(status) ? (
        <form
          action={save}
          onInput={() => {
            setDirty(true);
          }}
          className={card}
          noValidate
        >
          <FormError message={errors.form} />
          <Field label="Title" name="title" defaultValue={title} error={errors.title} />
          <div className="space-y-1.5">
            <label htmlFor="body" className="block text-sm font-medium">
              {channelName(channel)} post
            </label>
            <textarea
              id="body"
              name="body"
              rows={12}
              defaultValue={body}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            {errors.body ? (
              <p role="alert" className="text-sm text-red-600">
                {errors.body}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
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
        <h2 className="font-semibold">Approve, then post it yourself</h2>
        <FormError message={approveState.errors?.form} />
        <div className="flex flex-wrap items-center gap-3">
          <form action={approve}>
            <button
              type="submit"
              disabled={dirty || status !== "in_review"}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve post
            </button>
          </form>
          <CopyButton text={title} label="title" />
          <CopyButton text={body} label="post" />
          <a
            href={postPages[channel]}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {openLabels[channel]}
          </a>
        </div>
        <p className="text-xs text-slate-500">
          {channelName(channel)} posts are drafts only: LaunchPilot never posts them for you.
        </p>
      </section>
    </div>
  );
}
