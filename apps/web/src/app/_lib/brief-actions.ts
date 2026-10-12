"use server";

import { productId } from "@launchpilot/domain";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getAppContainer } from "../../container";
import { briefForm, parseForm, type FieldErrors } from "../../server/forms";
import { draftFailureMessage } from "../../server/messages";
import { requireUser } from "./auth";

export interface BriefActionState {
  readonly errors?: FieldErrors;
  /** Claims left out of the last draft because the site did not support them. */
  readonly droppedClaims?: readonly string[];
}

const briefPath = (id: string) => `/app/products/${id}/brief`;

/** Bound action arguments come from the client, so they are validated like any input. */
const productIdParam = z.string().regex(/^[\w-]{1,100}$/);

const target = async (id: string) => {
  const parsed = productIdParam.safeParse(id);
  if (!parsed.success) notFound();
  const { user, workspace } = await requireUser();
  return { user, workspace, productId: productId(parsed.data) };
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
