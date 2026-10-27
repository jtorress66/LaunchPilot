"use client";

import {
  blogPlatformIds,
  blogPlatforms,
  isBlogPlatform,
  type BlogPlatform,
} from "@nuvantre/domain";
import { useActionState, useState } from "react";
import { connectBlogAction, type SeoActionState } from "../../app/_lib/seo-actions";
import { Field } from "../forms/field";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";

const select =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export interface ConnectedBlog {
  readonly platform: BlogPlatform;
  readonly siteName: string;
  readonly siteUrl: string;
}

export function BlogConnectionForm({
  productId,
  connected,
}: {
  readonly productId: string;
  readonly connected: ConnectedBlog | null;
}) {
  const [state, action] = useActionState<SeoActionState, FormData>(
    connectBlogAction.bind(null, productId),
    {},
  );
  const [platform, setPlatform] = useState<BlogPlatform>(connected?.platform ?? "wordpress");
  const errors = state.errors ?? {};
  const info = blogPlatforms[platform];

  return (
    <div className="space-y-4">
      {connected ? (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          Connected to <strong>{connected.siteName}</strong> on{" "}
          {blogPlatforms[connected.platform].name} ({connected.siteUrl})
        </p>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Your key is stored encrypted and used only to publish articles you approve.
        </p>
      )}
      <form action={action} className="space-y-4" noValidate>
        <FormError message={errors.form} />
        <div className="space-y-1.5">
          <label htmlFor="platform" className="block text-sm font-medium">
            Platform
          </label>
          <select
            id="platform"
            name="platform"
            value={platform}
            onChange={(event) => {
              if (isBlogPlatform(event.target.value)) setPlatform(event.target.value);
            }}
            className={select}
          >
            {blogPlatformIds.map((id) => (
              <option key={id} value={id}>
                {blogPlatforms[id].name}
              </option>
            ))}
          </select>
        </div>
        {/* Keyed by platform so switching clears what was typed for another platform. */}
        <div key={platform} className="space-y-4">
          <Field
            label={info.siteLabel}
            name="siteUrl"
            type="url"
            placeholder={
              platform === "shopify" ? "https://acme.myshopify.com" : "https://blog.acme.dev"
            }
            error={errors.siteUrl}
          />
          {info.fields.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              name={field.key}
              hint={field.hint}
              error={errors[field.key]}
            />
          ))}
          <Field
            label={info.secret.label}
            name="secret"
            type="password"
            autoComplete="off"
            hint={info.secret.hint}
            error={errors.secret}
          />
        </div>
        <SubmitButton pending="Checking your blog…">
          {connected ? "Reconnect blog" : "Connect blog"}
        </SubmitButton>
      </form>
    </div>
  );
}
