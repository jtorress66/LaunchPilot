"use server";

import { productId } from "@nuvantre/domain";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getAppContainer } from "../../container";
import {
  analyticsPropertiesForm,
  parseForm,
  plausibleForm,
  type FieldErrors,
} from "../../server/forms";
import { analyticsFailureMessage, fieldFor } from "../../server/messages";
import { requireUser } from "./auth";
import { idParam } from "./params";

export interface AnalyticsActionState {
  readonly errors?: FieldErrors;
}

const analyticsPath = (id: string) => `/app/products/${id}/analytics`;

const failed = (error: { code: string; message: string }): AnalyticsActionState => ({
  errors: { form: analyticsFailureMessage(error) },
});

export async function connectPlausibleAction(
  rawId: string,
  _state: AnalyticsActionState,
  data: FormData,
): Promise<AnalyticsActionState> {
  const id = idParam(rawId);
  const { workspace } = await requireUser();
  const form = parseForm(plausibleForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().analytics.connectPlausible.execute({
    workspace,
    productId: productId(id),
    ...form.value,
  });
  if (!result.ok) {
    // A malformed address belongs next to its input; everything else is a form error.
    const field = fieldFor(result.error.code) === "url" ? "baseUrl" : "form";
    return field === "form" ? failed(result.error) : { errors: { baseUrl: result.error.message } };
  }
  revalidatePath(analyticsPath(id));
  redirect(`${analyticsPath(id)}?plausible=connected`);
}

export async function chooseGooglePropertiesAction(
  rawId: string,
  _state: AnalyticsActionState,
  data: FormData,
): Promise<AnalyticsActionState> {
  const id = idParam(rawId);
  const { workspace } = await requireUser();
  const google = getAppContainer().analytics.google;
  if (!google) notFound();
  const form = parseForm(analyticsPropertiesForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await google.chooseProperties.execute({
    workspace,
    productId: productId(id),
    ...form.value,
  });
  if (!result.ok) return failed(result.error);
  revalidatePath(analyticsPath(id));
  redirect(`${analyticsPath(id)}?google=saved`);
}

const PROVIDERS = ["google", "plausible"] as const;

export async function disconnectAnalyticsAction(rawId: string, provider: string): Promise<void> {
  const id = idParam(rawId);
  const { workspace } = await requireUser();
  const known = PROVIDERS.find((p) => p === provider);
  if (!known) notFound();
  await getAppContainer().analytics.disconnect.execute({
    workspace,
    productId: productId(id),
    provider: known,
  });
  revalidatePath(analyticsPath(id));
}

export async function buildReportAction(rawId: string): Promise<AnalyticsActionState> {
  const id = idParam(rawId);
  const { workspace } = await requireUser();
  const result = await getAppContainer().analytics.generateReport.execute({
    workspace,
    productId: productId(id),
  });
  if (!result.ok) return failed(result.error);
  revalidatePath(analyticsPath(id));
  redirect(`${analyticsPath(id)}/${result.value.weekKey}`);
}
