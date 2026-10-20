"use client";

import { useActionState } from "react";
import { generateLaunchKitAction, type LaunchActionState } from "../../app/_lib/launch-actions";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";

export function GenerateKitButton({
  productId,
  regenerate,
}: {
  readonly productId: string;
  readonly regenerate: boolean;
}) {
  const [state, action] = useActionState<LaunchActionState>(
    generateLaunchKitAction.bind(null, productId),
    {},
  );
  return (
    <form action={action} className="space-y-2">
      <div className="sm:w-64">
        <SubmitButton pending="Writing your launch kit…">
          {regenerate ? "Regenerate launch kit" : "Generate launch kit"}
        </SubmitButton>
      </div>
      <FormError message={state.errors?.form} />
    </form>
  );
}
