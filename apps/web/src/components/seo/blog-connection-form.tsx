"use client";

import { useActionState } from "react";
import { connectBlogAction, type SeoActionState } from "../../app/_lib/seo-actions";
import { Field } from "../forms/field";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";

export function BlogConnectionForm({
  productId,
  connected,
}: {
  readonly productId: string;
  readonly connected: { readonly siteName: string; readonly siteUrl: string } | null;
}) {
  const [state, action] = useActionState<SeoActionState, FormData>(
    connectBlogAction.bind(null, productId),
    {},
  );
  const errors = state.errors ?? {};

  return (
    <div className="space-y-4">
      {connected ? (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          Connected to <strong>{connected.siteName}</strong> ({connected.siteUrl})
        </p>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          In WordPress, open <em>Users → Profile → Application Passwords</em>, create one named
          &ldquo;Nuvantre&rdquo; and paste it here. It is stored encrypted and used only to publish
          articles you approve.
        </p>
      )}
      <form action={action} className="space-y-4" noValidate>
        <FormError message={errors.form} />
        <Field
          label="Blog address"
          name="siteUrl"
          type="url"
          placeholder="https://blog.acme.dev"
          error={errors.siteUrl}
        />
        <Field label="WordPress username" name="username" error={errors.username} />
        <Field
          label="Application Password"
          name="secret"
          type="password"
          autoComplete="off"
          error={errors.secret}
        />
        <SubmitButton pending="Checking your blog…">
          {connected ? "Reconnect blog" : "Connect blog"}
        </SubmitButton>
      </form>
    </div>
  );
}
