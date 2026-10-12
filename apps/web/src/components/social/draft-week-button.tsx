"use client";

import { useActionState } from "react";
import { draftSocialWeekAction, type SocialActionState } from "../../app/_lib/social-actions";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";

export function DraftWeekButton({ productId }: { readonly productId: string }) {
  const [state, action] = useActionState<SocialActionState>(
    draftSocialWeekAction.bind(null, productId),
    {},
  );
  return (
    <form action={action} className="space-y-2">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        3 posts for X and 2 for LinkedIn, written from your approved brief. Each goes to your inbox
        for approval.
      </p>
      <div className="sm:w-56">
        <SubmitButton pending="Writing posts…">Draft this week&apos;s posts</SubmitButton>
      </div>
      <FormError message={state.errors?.form} />
      {state.notice ? (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}
