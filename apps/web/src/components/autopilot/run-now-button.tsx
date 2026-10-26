"use client";

import { useActionState } from "react";
import { runAutopilotNowAction, type AutopilotActionState } from "../../app/_lib/autopilot-actions";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";

export function RunNowButton({ productId }: { readonly productId: string }) {
  const [state, action] = useActionState<AutopilotActionState>(
    runAutopilotNowAction.bind(null, productId),
    {},
  );
  return (
    <form action={action} className="space-y-2">
      <div className="sm:w-64">
        <SubmitButton pending="Planning and drafting the week…">Run this week now</SubmitButton>
      </div>
      <FormError message={state.error} />
    </form>
  );
}
