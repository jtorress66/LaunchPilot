"use server";

import { productId } from "@nuvantre/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppContainer } from "../../container";
import { briefForm, parseForm, type FieldErrors } from "../../server/forms";
import { draftFailureMessage } from "../../server/messages";
import { requireUser } from "./auth";
import { idParam } from "./params";

export interface BriefActionState {
  readonly errors?: FieldErrors;
  /** Claims left out of the last draft because the site did not support them. */
  readonly droppedClaims?: readonly string[];
}

const briefPath = (id: string) => `/app/products/${id}/brief`;

const target = async (id: string) => {
  const { user, workspace } = await requireUser();
  return { user, workspace, productId: productId(idParam(id)) };
};

const formError = (message: string): BriefActionState => ({ errors: { form: message } });

export async function draftBriefAction(id: string): Promise<BriefActionState> {
  const { workspace, productId } = await target(id);
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
  const { workspace, productId } = await target(id);
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
  const { user, workspace, productId } = await target(id);
  const result = await getAppContainer().approveBrief.execute({
    workspace,
    productId,
    actor: { kind: "founder", userId: user.id },
  });
  if (!result.ok) return formError(result.error.message);
  revalidatePath("/app");
  redirect(briefPath(id));
}
