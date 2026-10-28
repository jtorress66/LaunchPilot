"use server";

import { productId, userId, workspaceId } from "@nuvantre/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppContainer } from "../../container";
import {
  brandingForm,
  clientForm,
  inviteForm,
  parseForm,
  parseInviteToken,
  sendReportForm,
  switchWorkspaceForm,
  type FieldErrors,
} from "../../server/forms";
import { fieldFor, mailFailureMessage } from "../../server/messages";
import { currentSessionToken, requireAccess, requireUser } from "./auth";
import { refusedByLimit } from "./limits";
import { idParam } from "./params";

export interface AgencyFormState {
  readonly errors?: FieldErrors;
  /** A confirmation to show, such as "Invitation sent to …". */
  readonly done?: string;
}

const formError = (message: string): AgencyFormState => ({ errors: { form: message } });

/** Opens another workspace the person can reach; the session remembers it. */
export async function switchWorkspaceAction(data: FormData): Promise<void> {
  await requireUser();
  const form = parseForm(switchWorkspaceForm, data);
  const token = await currentSessionToken();
  if (form.ok && token) {
    await getAppContainer().switchWorkspace.execute({
      token,
      workspaceId: workspaceId(form.value.workspaceId),
    });
  }
  revalidatePath("/app", "layout");
  redirect("/app");
}

export async function addClientAction(
  _state: AgencyFormState,
  data: FormData,
): Promise<AgencyFormState> {
  const access = await requireAccess("manage_clients");
  const form = parseForm(clientForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().addClient.execute({ access, name: form.value.name });
  if (!result.ok) return { errors: { [fieldFor(result.error.code)]: result.error.message } };
  revalidatePath("/app", "layout");
  return { done: `Added ${result.value.name}` };
}

export async function inviteMemberAction(
  _state: AgencyFormState,
  data: FormData,
): Promise<AgencyFormState> {
  const access = await requireAccess("manage_team");
  const form = parseForm(inviteForm, data);
  if (!form.ok) return { errors: form.error };
  const limited = await refusedByLimit("email", access.workspace.id);
  if (limited) return formError(limited);
  const result = await getAppContainer().inviteMember.execute({ access, ...form.value });
  if (!result.ok) {
    return result.error.code === "invalid_email"
      ? { errors: { email: result.error.message } }
      : formError(mailFailureMessage(result.error));
  }
  revalidatePath("/app/team");
  return { done: `Invitation sent to ${result.value.email}` };
}

export async function removeMemberAction(rawUserId: string): Promise<AgencyFormState> {
  const access = await requireAccess("manage_team");
  const result = await getAppContainer().removeMember.execute({
    access,
    userId: userId(idParam(rawUserId)),
  });
  if (!result.ok) return formError(result.error.message);
  revalidatePath("/app/team");
  return { done: "Removed" };
}

export async function updateBrandingAction(
  _state: AgencyFormState,
  data: FormData,
): Promise<AgencyFormState> {
  const access = await requireAccess("manage_branding");
  const form = parseForm(brandingForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().updateBranding.execute({ access, ...form.value });
  if (!result.ok) return formError(result.error.message);
  revalidatePath("/app/branding");
  return { done: "Branding saved" };
}

export async function sendReportAction(
  rawProductId: string,
  weekKey: string,
  _state: AgencyFormState,
  data: FormData,
): Promise<AgencyFormState> {
  const access = await requireAccess("send_reports");
  const form = parseForm(sendReportForm, data);
  if (!form.ok) return { errors: form.error };
  const limited = await refusedByLimit("email", access.workspace.id);
  if (limited) return formError(limited);
  const result = await getAppContainer().sendReport.execute({
    access,
    productId: productId(idParam(rawProductId)),
    weekKey,
    ...form.value,
  });
  if (!result.ok) {
    return result.error.code === "invalid_email"
      ? { errors: { recipients: result.error.message } }
      : formError(mailFailureMessage(result.error));
  }
  return { done: `Sent to ${result.value.to.join(", ")}` };
}

/** Joins the invited workspace and opens it. */
export async function acceptInvitationAction(rawToken: string): Promise<AgencyFormState> {
  const { user } = await requireUser();
  const token = parseInviteToken(rawToken);
  const session = await currentSessionToken();
  if (!token || !session) return formError("This invitation link is not valid.");
  const result = await getAppContainer().acceptInvitation.execute({
    token,
    user,
    sessionToken: session,
  });
  if (!result.ok) return formError(result.error.message);
  revalidatePath("/app", "layout");
  redirect("/app");
}
