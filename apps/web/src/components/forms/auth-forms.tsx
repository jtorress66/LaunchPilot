"use client";

import { useActionState } from "react";
import { logInAction, signUpAction, type FormState } from "../../app/_lib/actions";
import { Field } from "./field";
import { FormError } from "./form-error";
import { SubmitButton } from "./submit-button";

const initial: FormState = {};

/** Carries an invitation through sign-up or log-in, back to its page. */
function InviteField({ invite }: { readonly invite: string | null }) {
  return invite ? <input type="hidden" name="invite" value={invite} /> : null;
}

export function SignUpForm({ invite = null }: { readonly invite?: string | null }) {
  const [state, action] = useActionState(signUpAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <InviteField invite={invite} />
      <FormError message={state.errors?.form} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={state.errors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters. A short sentence works well."
        error={state.errors?.password}
      />
      <SubmitButton pending="Creating your account…">Create account</SubmitButton>
    </form>
  );
}

export function LogInForm({ invite = null }: { readonly invite?: string | null }) {
  const [state, action] = useActionState(logInAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <InviteField invite={invite} />
      <FormError message={state.errors?.form} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={state.errors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={state.errors?.password}
      />
      <SubmitButton pending="Logging in…">Log in</SubmitButton>
    </form>
  );
}
