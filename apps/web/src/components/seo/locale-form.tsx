"use client";

import { useActionState } from "react";
import { setLocaleAction, type SeoActionState } from "../../app/_lib/seo-actions";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";
import { languageOptions, marketOptions } from "./locale-options";

const select =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

/** The language and market every article and post is written for. */
export function LocaleForm({
  productId,
  language,
  market,
}: {
  readonly productId: string;
  readonly language: string;
  readonly market: string;
}) {
  const [state, action] = useActionState<SeoActionState, FormData>(
    setLocaleAction.bind(null, productId),
    {},
  );
  const errors = state.errors ?? {};
  return (
    <form action={action} className="space-y-3">
      <FormError message={errors.form ?? errors.language ?? errors.market} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="language" className="block text-sm font-medium">
            Language
          </label>
          <select id="language" name="language" defaultValue={language} className={select}>
            {languageOptions.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="market" className="block text-sm font-medium">
            Market
          </label>
          <select id="market" name="market" defaultValue={market} className={select}>
            {marketOptions.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Articles and posts are written in this language. Keyword research uses search data for the
        market where it is available.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="sm:w-56">
          <SubmitButton pending="Saving…">Save language</SubmitButton>
        </div>
        {state.saved ? (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {state.saved}
          </p>
        ) : null}
      </div>
    </form>
  );
}
