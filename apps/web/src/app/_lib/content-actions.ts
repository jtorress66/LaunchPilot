"use server";

import { contentItemId } from "@launchpilot/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppContainer } from "../../container";
import { articleForm, parseForm, type FieldErrors } from "../../server/forms";
import { requireUser } from "./auth";
import { idParam } from "./params";

export interface ContentActionState {
  readonly errors?: FieldErrors;
}

const contentPath = (id: string) => `/app/content/${id}`;
const formError = (message: string): ContentActionState => ({ errors: { form: message } });

const target = async (id: string) => {
  const { user, workspace } = await requireUser();
  return { user, workspace, itemId: contentItemId(idParam(id)) };
};

export async function saveArticleAction(
  id: string,
  _state: ContentActionState,
  data: FormData,
): Promise<ContentActionState> {
  const { workspace, itemId } = await target(id);
  const form = parseForm(articleForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().reviseContentItem.execute({
    workspace,
    itemId,
    ...form.value,
  });
  if (!result.ok) return formError(result.error.message);
  redirect(`${contentPath(id)}?saved=1`);
}

export async function approveArticleAction(id: string): Promise<ContentActionState> {
  const { user, workspace, itemId } = await target(id);
  const result = await getAppContainer().approveContentItem.execute({
    workspace,
    itemId,
    actor: { kind: "founder", userId: user.id },
  });
  if (!result.ok) return formError(result.error.message);
  redirect(contentPath(id));
}

export async function publishArticleAction(id: string): Promise<ContentActionState> {
  const { workspace, itemId } = await target(id);
  const result = await getAppContainer().publishContentItem.execute({ workspace, itemId });
  if (!result.ok) return formError(result.error.message);
  revalidatePath("/app");
  redirect(contentPath(id));
}
