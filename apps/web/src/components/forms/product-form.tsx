"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createProductAction, type FormState } from "../../app/_lib/actions";
import { Field } from "./field";
import { SubmitButton } from "./submit-button";

export function ProductForm() {
  const [state, action] = useActionState(createProductAction, {} as FormState);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.errors?.form ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {state.errors.form}{" "}
          <Link href="/app/billing" className="font-semibold underline">
            See plans
          </Link>
        </div>
      ) : null}
      <Field
        label="Product name"
        name="name"
        placeholder="Acme Analytics"
        error={state.errors?.name}
      />
      <Field
        label="Website"
        name="url"
        type="url"
        placeholder="https://acme.dev"
        error={state.errors?.url}
      />
      <SubmitButton pending="Adding…">Add product</SubmitButton>
    </form>
  );
}
