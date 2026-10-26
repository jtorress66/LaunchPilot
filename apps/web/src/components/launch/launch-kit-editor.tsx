"use client";

import { listingLimits, type LaunchKitStatus, type Listing } from "@nuvantre/domain";
import { useActionState, useState } from "react";
import {
  approveLaunchKitAction,
  saveLaunchKitAction,
  type LaunchActionState,
} from "../../app/_lib/launch-actions";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";

interface FieldSpec {
  readonly name: keyof Listing;
  readonly label: string;
  readonly limit: number;
  readonly rows?: number;
  readonly hint?: string;
}

const fields: readonly FieldSpec[] = [
  { name: "name", label: "Name", limit: listingLimits.name },
  { name: "tagline", label: "Tagline", limit: listingLimits.tagline },
  {
    name: "shortDescription",
    label: "Short description",
    limit: listingLimits.shortDescription,
    rows: 2,
  },
  {
    name: "longDescription",
    label: "Long description",
    limit: listingLimits.longDescription,
    rows: 6,
  },
  { name: "features", label: "Key features", limit: 6, rows: 5, hint: "3 to 6, one per line" },
  { name: "categories", label: "Categories", limit: 3, rows: 3, hint: "1 to 3, one per line" },
  {
    name: "makerComment",
    label: "Maker's first comment",
    limit: listingLimits.makerComment,
    rows: 6,
  },
];

const asText = (value: Listing[keyof Listing]) =>
  typeof value === "string" ? value : value.join("\n");

const countOf = (spec: FieldSpec, value: string) =>
  spec.name === "features" || spec.name === "categories"
    ? value.split("\n").filter((line) => line.trim() !== "").length
    : value.length;

export function LaunchKitEditor({
  productId,
  listing,
  status,
  justSaved = false,
}: {
  readonly productId: string;
  readonly listing: Listing;
  readonly status: LaunchKitStatus;
  readonly justSaved?: boolean;
}) {
  const [saveState, save] = useActionState<LaunchActionState, FormData>(
    saveLaunchKitAction.bind(null, productId),
    {},
  );
  const [approveState, approve] = useActionState<LaunchActionState>(
    approveLaunchKitAction.bind(null, productId),
    {},
  );
  const initial = Object.fromEntries(fields.map((f) => [f.name, asText(listing[f.name])]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const dirty = fields.some((f) => values[f.name] !== initial[f.name]);
  const errors = saveState.errors ?? {};

  return (
    <div className="space-y-4">
      <form action={save} className="space-y-4" noValidate>
        <FormError message={errors.form} />
        {fields.map((spec) => {
          const value = values[spec.name] ?? "";
          const count = countOf(spec, value);
          const over = count > spec.limit;
          const id = `kit-${spec.name}`;
          return (
            <div key={spec.name} className="space-y-1">
              <label htmlFor={id} className="block text-sm font-medium">
                {spec.label}
              </label>
              <textarea
                id={id}
                name={spec.name}
                rows={spec.rows ?? 1}
                value={value}
                onChange={(event) => {
                  setValues({ ...values, [spec.name]: event.target.value });
                }}
                aria-invalid={over || errors[spec.name] ? true : undefined}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 aria-invalid:border-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <p className={`text-xs ${over ? "font-semibold text-red-600" : "text-slate-500"}`}>
                {spec.hint ? `${spec.hint} · ` : ""}
                {count} / {spec.limit}
              </p>
              {errors[spec.name] ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {errors[spec.name]}
                </p>
              ) : null}
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-40">
            <SubmitButton pending="Saving…">Save kit</SubmitButton>
          </div>
          {justSaved && !dirty && status === "draft" ? (
            <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
              Saved. Approve it again before submitting.
            </p>
          ) : null}
        </div>
      </form>
      <form action={approve} className="space-y-2">
        <FormError message={approveState.errors?.form} />
        <button
          type="submit"
          disabled={dirty || status === "approved"}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Approve launch kit
        </button>
        {dirty ? <p className="text-sm text-slate-500">Save your changes first.</p> : null}
      </form>
    </div>
  );
}
