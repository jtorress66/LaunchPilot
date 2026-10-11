"use client";

import { useActionState } from "react";
import { logInAction, signUpAction, type FormState } from "../../app/_lib/actions";
import { Field } from "./field";
import { FormError } from "./form-error";
import { SubmitButton } from "./submit-button";

const initial: FormState = {};

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
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

export function LogInForm() {
  const [state, action] = useActionState(logInAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
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
