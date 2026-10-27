"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppContainer } from "../../container";
import {
  logInForm,
  parseForm,
  productForm,
  signUpForm,
  upgradeForm,
  type FieldErrors,
} from "../../server/forms";
import { fieldFor } from "../../server/messages";
import { requireUser, setSessionCookie, takeSessionCookie } from "./auth";

export interface FormState {
  readonly errors?: FieldErrors;
  readonly saved?: boolean;
}

const failed = (error: { code: string; message: string }): FormState => ({
  errors: { [fieldFor(error.code)]: error.message },
});

export async function signUpAction(_state: FormState, data: FormData): Promise<FormState> {
  const form = parseForm(signUpForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().signUp.execute(form.value);
  if (!result.ok) return failed(result.error);
  await setSessionCookie(result.value.session);
  redirect("/app");
}

export async function logInAction(_state: FormState, data: FormData): Promise<FormState> {
  const form = parseForm(logInForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().logIn.execute(form.value);
  if (!result.ok) return failed(result.error);
  await setSessionCookie(result.value);
  redirect("/app");
}

export async function logOutAction(): Promise<void> {
  const token = await takeSessionCookie();
  if (token) await getAppContainer().logOut.execute(token);
  redirect("/");
}

export async function createProductAction(_state: FormState, data: FormData): Promise<FormState> {
  const { workspace } = await requireUser();
  const form = parseForm(productForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().createProduct.execute({ workspace, ...form.value });
  if (!result.ok) return failed(result.error);
  revalidatePath("/app");
  // Onboarding continues with the Product Brief, which every later agent relies on.
  redirect(`/app/products/${result.value.id}/brief`);
}

export async function upgradeAction(data: FormData): Promise<void> {
  const { user, workspace } = await requireUser();
  const form = parseForm(upgradeForm, data);
  if (!form.ok) redirect("/app/billing");
  const result = await getAppContainer().startCheckout.execute({
    user,
    workspace,
    plan: form.value.plan,
  });
  redirect(result.ok ? result.value.url : "/app/billing?checkout=unavailable");
}

/** Test-mode "Cancel plan": drops to Free, as a cancellation would. Unavailable with Stripe. */
export async function cancelLocalPlanAction(): Promise<void> {
  const { workspace } = await requireUser();
  const simulator = getAppContainer().localCheckout;
  if (!simulator) redirect("/app/billing");
  const result = await simulator.cancel({ workspaceId: workspace.id });
  redirect(result.ok ? "/app/billing?checkout=canceled_plan" : "/app/billing?checkout=unavailable");
}

/** The "Pay" button of the local test-mode checkout. Unavailable when Stripe is configured. */
export async function payLocalCheckoutAction(data: FormData): Promise<void> {
  const { workspace } = await requireUser();
  const form = parseForm(upgradeForm, data);
  const simulator = getAppContainer().localCheckout;
  if (!form.ok || !simulator) redirect("/app/billing");
  const result = await simulator.pay({ workspaceId: workspace.id, plan: form.value.plan });
  redirect(result.ok ? "/app/billing?checkout=success" : "/app/billing?checkout=unavailable");
}
