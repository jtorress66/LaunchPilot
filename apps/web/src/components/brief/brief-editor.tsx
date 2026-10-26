"use client";

import type { BriefContent, BriefStatus } from "@nuvantre/domain";
import { useActionState, useState } from "react";
import {
  approveBriefAction,
  saveBriefAction,
  type BriefActionState,
} from "../../app/_lib/brief-actions";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";
import { TextAreaField } from "../forms/text-area-field";

interface BriefEditorProps {
  readonly productId: string;
  readonly content: BriefContent;
  readonly status: BriefStatus;
  /** True right after a save, until the founder edits again. */
  readonly justSaved: boolean;
}

const ONE_PER_LINE = "One per line.";

export function BriefEditor({ productId, content, status, justSaved }: BriefEditorProps) {
  const [saveState, save] = useActionState<BriefActionState, FormData>(
    saveBriefAction.bind(null, productId),
    {},
  );
  const [approveState, approve] = useActionState<BriefActionState>(
    approveBriefAction.bind(null, productId),
    {},
  );
  const [dirty, setDirty] = useState(false);
  const errors = saveState.errors ?? {};

  return (
    <div className="space-y-6">
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
            Saving changes returns the brief to draft until you approve it again.
          </p>
        ) : null}
        <FormError message={errors.form} />
        <TextAreaField
          label="Audience"
          name="audience"
          defaultValue={content.audience}
          rows={2}
          error={errors.audience}
        />
        <TextAreaField
          label="Problem"
          name="problem"
          defaultValue={content.problem}
          error={errors.problem}
        />
        <TextAreaField
          label="Solution"
          name="solution"
          defaultValue={content.solution}
          error={errors.solution}
        />
        <TextAreaField
          label="Differentiators"
          name="differentiators"
          defaultValue={content.differentiators.join("\n")}
          rows={4}
          hint={ONE_PER_LINE}
          error={errors.differentiators}
        />
        <TextAreaField
          label="Product facts"
          name="facts"
          defaultValue={content.facts.join("\n")}
          rows={6}
          hint={`${ONE_PER_LINE} Agents will only ever state these facts about your product.`}
          error={errors.facts}
        />
        <TextAreaField
          label="Tone"
          name="tone"
          defaultValue={content.tone}
          rows={1}
          error={errors.tone}
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

      <form
        action={approve}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="font-semibold">Approval</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {status === "approved"
            ? "This brief is approved. Agents use it for everything they write."
            : "Agents start working only after you approve the brief."}
        </p>
        <FormError message={approveState.errors?.form} />
        {dirty ? (
          <p className="text-sm text-slate-500">Save your changes before approving.</p>
        ) : null}
        <ApproveButton disabled={dirty || status === "approved"} />
      </form>
    </div>
  );
}

function ApproveButton({ disabled }: { readonly disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Approve brief
    </button>
  );
}
