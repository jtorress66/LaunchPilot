"use client";

import { useActionState } from "react";
import { approveFromInboxAction, type SocialActionState } from "../../app/_lib/social-actions";
import { FormError } from "../forms/form-error";

export function InboxApproveButton({
  itemId,
  title,
}: {
  readonly itemId: string;
  readonly title: string;
}) {
  const [state, action, pending] = useActionState<SocialActionState>(
    approveFromInboxAction.bind(null, itemId),
    {},
  );
  return (
    <form action={action} className="space-y-1">
      <button
        type="submit"
        disabled={pending}
        aria-label={`Approve “${title}”`}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Approving…" : "Approve"}
      </button>
      <FormError message={state.errors?.form} />
    </form>
  );
}
