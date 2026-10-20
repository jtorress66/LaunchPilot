"use client";

import { useActionState } from "react";
import { addToLaunchAction, type LaunchActionState } from "../../app/_lib/launch-actions";
import { FormError } from "../forms/form-error";

export function AddDirectoryButton({
  productId,
  slug,
  name,
}: {
  readonly productId: string;
  readonly slug: string;
  readonly name: string;
}) {
  const [state, action, pending] = useActionState<LaunchActionState>(
    addToLaunchAction.bind(null, productId, slug),
    {},
  );
  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        aria-label={`Add ${name} to my launch`}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add to my launch"}
      </button>
      <FormError message={state.errors?.form} />
    </form>
  );
}
