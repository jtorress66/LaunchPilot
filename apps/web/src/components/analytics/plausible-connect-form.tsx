"use client";

import { useActionState } from "react";
import {
  connectPlausibleAction,
  type AnalyticsActionState,
} from "../../app/_lib/analytics-actions";
import { Field } from "../forms/field";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";

export function PlausibleConnectForm({ productId }: { readonly productId: string }) {
  const [state, action] = useActionState<AnalyticsActionState, FormData>(
    connectPlausibleAction.bind(null, productId),
    {},
  );
  const errors = state.errors ?? {};
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormError message={errors.form} />
      <Field label="Site domain" name="siteId" placeholder="acme.dev" error={errors.siteId} />
      <Field
        label="Stats API key"
        name="apiKey"
        type="password"
        autoComplete="off"
        hint="Plausible → Settings → API keys → New key (Stats API)."
        error={errors.apiKey}
      />
      <Field
        label="Self-hosted address (optional)"
        name="baseUrl"
        placeholder="https://plausible.io"
        error={errors.baseUrl}
      />
      <div className="sm:w-56">
        <SubmitButton pending="Checking…">Connect Plausible</SubmitButton>
      </div>
    </form>
  );
}
