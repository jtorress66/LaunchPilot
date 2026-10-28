"use server";

import { productId, type WorkspaceAction } from "@nuvantre/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppContainer } from "../../container";
import { briefForm, parseForm, type FieldErrors } from "../../server/forms";
import { draftFailureMessage } from "../../server/messages";
import { refusedByLimit } from "./limits";
import { requireAccess } from "./auth";
import { idParam } from "./params";

export interface BriefActionState {
  readonly errors?: FieldErrors;
  /** Claims left out of the last draft because the site did not support them. */
  readonly droppedClaims?: readonly string[];
}

const briefPath = (id: string) => `/app/products/${id}/brief`;

const target = async (id: string, action: WorkspaceAction) => {
  const access = await requireAccess(action);
  return { access, workspace: access.workspace, productId: productId(idParam(id)) };
};

const formError = (message: string): BriefActionState => ({ errors: { form: message } });

export async function draftBriefAction(id: string): Promise<BriefActionState> {
  const { workspace, productId } = await target(id, "draft");
  const limited = await refusedByLimit("draft", workspace.id);
  if (limited) return formError(limited);
  const result = await getAppContainer().generateBrief.execute({ workspace, productId });
  if (!result.ok) return formError(draftFailureMessage(result.error));
  revalidatePath(briefPath(id));
  return { droppedClaims: result.value.droppedClaims };
}

export async function saveBriefAction(
  id: string,
  _state: BriefActionState,
  data: FormData,
): Promise<BriefActionState> {
  const { workspace, productId } = await target(id, "draft");
  const form = parseForm(briefForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().updateBrief.execute({
    workspace,
    productId,
    content: form.value,
  });
  if (!result.ok) return formError(result.error.message);
  revalidatePath("/app");
  redirect(`${briefPath(id)}?saved=1`);
}

export async function approveBriefAction(id: string): Promise<BriefActionState> {
  const { access, productId } = await target(id, "approve");
  const result = await getAppContainer().approveBrief.execute({ access, productId });
  if (!result.ok) return formError(result.error.message);
  revalidatePath("/app");
  redirect(briefPath(id));
}
