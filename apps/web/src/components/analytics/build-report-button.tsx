"use client";

import { useActionState } from "react";
import { buildReportAction, type AnalyticsActionState } from "../../app/_lib/analytics-actions";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";

export function BuildReportButton({ productId }: { readonly productId: string }) {
  const [state, action] = useActionState<AnalyticsActionState>(
    buildReportAction.bind(null, productId),
    {},
  );
  return (
    <form action={action} className="space-y-2">
      <div className="sm:w-64">
        <SubmitButton pending="Building the report…">Build report now</SubmitButton>
      </div>
      <FormError message={state.errors?.form} />
    </form>
  );
}
