"use client";

import { useActionState } from "react";
import { draftBriefAction, type BriefActionState } from "../../app/_lib/brief-actions";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";

/**
 * Drafts (or redrafts) the brief from the product's site. It stays mounted while the
 * page refreshes, so the claims the drafter left out remain visible after drafting.
 */
export function DraftBriefForm({
  productId,
  host,
  hasBrief,
}: {
  readonly productId: string;
  readonly host: string;
  readonly hasBrief: boolean;
}) {
  const [state, action] = useActionState<BriefActionState>(
    draftBriefAction.bind(null, productId),
    {},
  );
  const dropped = state.droppedClaims ?? [];

  return (
    <div className="space-y-3">
      <form action={action} className={hasBrief ? "max-w-xs" : "max-w-sm"}>
        <SubmitButton pending="Reading your site…">
          {hasBrief ? `Redraft from ${host}` : `Draft my brief from ${host}`}
        </SubmitButton>
      </form>
      {hasBrief ? (
        <p className="text-xs text-slate-500">Redrafting replaces the brief with a new draft.</p>
      ) : null}
      <FormError message={state.errors?.form} />
      {dropped.length > 0 ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          <p className="font-medium">
            We left out {dropped.length === 1 ? "a claim" : `${dropped.length} claims`} your site
            didn&apos;t support:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {dropped.map((claim) => (
              <li key={claim}>{claim}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs">Add them as facts yourself if they are true.</p>
        </div>
      ) : null}
    </div>
  );
}
