"use client";

import { useActionState } from "react";
import { planSeoAction, type SeoActionState } from "../../app/_lib/seo-actions";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";
import { TextAreaField } from "../forms/text-area-field";

export function SeoPlanForm({ productId }: { readonly productId: string }) {
  const [state, action] = useActionState<SeoActionState, FormData>(
    planSeoAction.bind(null, productId),
    {},
  );
  const errors = state.errors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={errors.form} />
      <TextAreaField
        label="Topics your customers search for"
        name="seeds"
        defaultValue=""
        rows={3}
        hint="One per line, up to 5. We research keywords around them and pick the ones you can rank for."
        error={errors.seeds}
      />
      <div className="max-w-xs">
        <SubmitButton pending="Researching keywords…">Plan articles</SubmitButton>
      </div>
    </form>
  );
}
