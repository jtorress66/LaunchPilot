"use client";

import type { ContentItemStatus } from "@nuvantre/domain";
import { useActionState, useState } from "react";
import {
  approveArticleAction,
  publishArticleAction,
  saveArticleAction,
  type ContentActionState,
} from "../../app/_lib/content-actions";
import { Field } from "../forms/field";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";
import { TextAreaField } from "../forms/text-area-field";

interface ArticleEditorProps {
  readonly itemId: string;
  readonly title: string;
  readonly body: string;
  /** URL slug and excerpt for search results; null for an article drafted before they existed. */
  readonly seo: { readonly slug: string; readonly excerpt: string } | null;
  readonly status: ContentItemStatus;
  /** True right after a save, until the founder edits again. */
  readonly justSaved: boolean;
}

const EDITABLE: readonly ContentItemStatus[] = [
  "draft",
  "in_review",
  "approved",
  "rejected",
  "failed",
];

export function ArticleEditor({ itemId, title, body, seo, status, justSaved }: ArticleEditorProps) {
  const [saveState, save] = useActionState<ContentActionState, FormData>(
    saveArticleAction.bind(null, itemId),
    {},
  );
  const [approveState, approve] = useActionState<ContentActionState>(
    approveArticleAction.bind(null, itemId),
    {},
  );
  const [publishState, publish] = useActionState<ContentActionState>(
    publishArticleAction.bind(null, itemId),
    {},
  );
  const [dirty, setDirty] = useState(false);
  const errors = saveState.errors ?? {};
  const editable = EDITABLE.includes(status);

  return (
    <div className="space-y-6">
      {editable ? (
        <form
          action={save}
          onInput={() => {
            setDirty(true);
          }}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          noValidate
        >
          {status === "approved" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Saving changes sends the article back for your approval.
            </p>
          ) : null}
          <FormError message={errors.form} />
          <Field label="Title" name="title" defaultValue={title} error={errors.title} />
          <Field
            label="URL slug"
            name="slug"
            defaultValue={seo?.slug ?? ""}
            hint="Lower-case words joined by hyphens, e.g. cookieless-analytics."
            error={errors.slug}
          />
          <TextAreaField
            label="Excerpt"
            name="excerpt"
            defaultValue={seo?.excerpt ?? ""}
            rows={2}
            hint="Shown in search results and post lists. Up to 160 characters reads best."
            error={errors.excerpt}
          />
          <TextAreaField
            label="Article (Markdown)"
            name="body"
            defaultValue={body}
            rows={18}
            hint="## for section headings, - for lists, **bold**. HTML is not allowed."
            error={errors.body}
          />
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

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Approve and publish</h2>
        {dirty ? <p className="text-sm text-slate-500">Save your changes first.</p> : null}
        <FormError message={approveState.errors?.form ?? publishState.errors?.form} />
        <div className="flex flex-wrap gap-3">
          <form action={approve}>
            <ActionButton disabled={dirty || status !== "in_review"} tone="approve">
              Approve article
            </ActionButton>
          </form>
          <form action={publish}>
            <ActionButton disabled={dirty || status !== "approved"} tone="publish">
              Publish to blog
            </ActionButton>
          </form>
        </div>
        <p className="text-xs text-slate-500">
          Nothing is published until you approve it. Publishing posts the article to your connected
          blog.
        </p>
      </section>
    </div>
  );
}

function ActionButton({
  disabled,
  tone,
  children,
}: {
  readonly disabled: boolean;
  readonly tone: "approve" | "publish";
  readonly children: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "approve"
          ? "bg-emerald-600 hover:bg-emerald-700"
          : "bg-brand-600 hover:bg-brand-700"
      }`}
    >
      {children}
    </button>
  );
}
