"use server";

import { productId, submissionId, type SubmissionEvent } from "@launchpilot/domain";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getAppContainer } from "../../container";
import {
  launchKitForm,
  liveForm,
  parseForm,
  rejectForm,
  type FieldErrors,
} from "../../server/forms";
import { draftFailureMessage } from "../../server/messages";
import { requireUser } from "./auth";
import { idParam } from "./params";

export interface LaunchActionState {
  readonly errors?: FieldErrors;
}

const launchPath = (id: string) => `/app/products/${id}/launch`;
const formError = (message: string): LaunchActionState => ({ errors: { form: message } });

const done = (id: string): LaunchActionState => {
  revalidatePath(launchPath(id));
  revalidatePath("/app", "layout");
  return {};
};

export async function generateLaunchKitAction(id: string): Promise<LaunchActionState> {
  const { workspace } = await requireUser();
  const result = await getAppContainer().generateLaunchKit.execute({
    workspace,
    productId: productId(idParam(id)),
  });
  return result.ok ? done(id) : formError(draftFailureMessage(result.error));
}

export async function saveLaunchKitAction(
  id: string,
  _state: LaunchActionState,
  data: FormData,
): Promise<LaunchActionState> {
  const { workspace } = await requireUser();
  const form = parseForm(launchKitForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().reviseLaunchKit.execute({
    workspace,
    productId: productId(idParam(id)),
    listing: form.value,
  });
  if (!result.ok) return formError(result.error.message);
  done(id);
  redirect(`${launchPath(id)}?saved=1`);
}

export async function approveLaunchKitAction(id: string): Promise<LaunchActionState> {
  const { user, workspace } = await requireUser();
  const result = await getAppContainer().approveLaunchKit.execute({
    workspace,
    productId: productId(idParam(id)),
    actor: { kind: "founder", userId: user.id },
  });
  return result.ok ? done(id) : formError(result.error.message);
}

const SLUG = /^[a-z0-9-]{1,80}$/;

export async function addToLaunchAction(id: string, slug: string): Promise<LaunchActionState> {
  const { workspace } = await requireUser();
  // Bound arguments arrive from the browser, so the slug is validated like any input.
  if (!SLUG.test(slug)) notFound();
  const result = await getAppContainer().addToLaunch.execute({
    workspace,
    productId: productId(idParam(id)),
    directorySlug: slug,
  });
  return result.ok ? done(id) : formError(result.error.message);
}

const SIMPLE_EVENTS = ["submit", "skip", "reopen"] as const;

const update = async (id: string, rowId: string, event: SubmissionEvent) => {
  const { workspace } = await requireUser();
  const result = await getAppContainer().updateSubmission.execute({
    workspace,
    submissionId: submissionId(idParam(rowId)),
    event,
  });
  return result.ok ? done(id) : formError(result.error.message);
};

/** Submitted, Skip or Reopen on one tracker row. */
export async function moveSubmissionAction(
  id: string,
  rowId: string,
  type: string,
): Promise<LaunchActionState> {
  const event = SIMPLE_EVENTS.find((e) => e === type);
  if (!event) notFound();
  return update(idParam(id), rowId, { type: event });
}

export async function markLiveAction(
  id: string,
  rowId: string,
  _state: LaunchActionState,
  data: FormData,
): Promise<LaunchActionState> {
  const form = parseForm(liveForm, data);
  if (!form.ok) return { errors: form.error };
  return update(idParam(id), rowId, { type: "markLive", listingUrl: form.value.listingUrl });
}

export async function rejectSubmissionAction(
  id: string,
  rowId: string,
  _state: LaunchActionState,
  data: FormData,
): Promise<LaunchActionState> {
  const form = parseForm(rejectForm, data);
  if (!form.ok) return { errors: form.error };
  return update(idParam(id), rowId, { type: "reject", reason: form.value.reason });
}
