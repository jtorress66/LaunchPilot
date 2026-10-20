"use client";

import type { AnalyticsProperties } from "@launchpilot/ports";
import { useActionState } from "react";
import {
  chooseGooglePropertiesAction,
  type AnalyticsActionState,
} from "../../app/_lib/analytics-actions";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";

const select =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export function GooglePropertiesForm({
  productId,
  properties,
  chosen,
}: {
  readonly productId: string;
  readonly properties: AnalyticsProperties;
  readonly chosen: { searchConsoleSite: string | null; ga4PropertyId: string | null };
}) {
  const [state, action] = useActionState<AnalyticsActionState, FormData>(
    chooseGooglePropertiesAction.bind(null, productId),
    {},
  );
  return (
    <form action={action} className="space-y-3">
      <FormError message={state.errors?.form} />
      <div className="space-y-1">
        <label htmlFor="searchConsoleSite" className="block text-sm font-medium">
          Search Console property
        </label>
        <select
          id="searchConsoleSite"
          name="searchConsoleSite"
          defaultValue={chosen.searchConsoleSite ?? ""}
          className={select}
        >
          <option value="">None</option>
          {properties.searchConsoleSites.map((s) => (
            <option key={s.siteUrl} value={s.siteUrl}>
              {s.siteUrl.replace(/^sc-domain:/, "")}
              {s.siteUrl.startsWith("sc-domain:") ? " (domain)" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="ga4PropertyId" className="block text-sm font-medium">
          GA4 property
        </label>
        <select
          id="ga4PropertyId"
          name="ga4PropertyId"
          defaultValue={chosen.ga4PropertyId ?? ""}
          className={select}
        >
          <option value="">None</option>
          {properties.ga4Properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.account})
            </option>
          ))}
        </select>
      </div>
      <div className="sm:w-56">
        <SubmitButton pending="Saving…">Save properties</SubmitButton>
      </div>
    </form>
  );
}
