"use server";

import { contentItemId, type WorkspaceAction } from "@nuvantre/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppContainer } from "../../container";
import { articleForm, articleRejectForm, parseForm, type FieldErrors } from "../../server/forms";
import { requireAccess } from "./auth";
import { idParam } from "./params";

export interface ContentActionState {
  readonly errors?: FieldErrors;
}

const contentPath = (id: string) => `/app/content/${id}`;
const formError = (message: string): ContentActionState => ({ errors: { form: message } });

const target = async (id: string, action: WorkspaceAction) => {
  const access = await requireAccess(action);
  return { access, workspace: access.workspace, itemId: contentItemId(idParam(id)) };
};

export async function saveArticleAction(
  id: string,
  _state: ContentActionState,
  data: FormData,
): Promise<ContentActionState> {
  const { workspace, itemId } = await target(id, "draft");
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
  const { access, itemId } = await target(id, "approve");
  const result = await getAppContainer().approveContentItem.execute({ access, itemId });
  if (!result.ok) return formError(result.error.message);
  redirect(contentPath(id));
}

export async function rejectArticleAction(
  id: string,
  _state: ContentActionState,
  data: FormData,
): Promise<ContentActionState> {
  const { access, itemId } = await target(id, "approve");
  const form = parseForm(articleRejectForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().rejectContentItem.execute({
    access,
    itemId,
    reason: form.value.reason,
  });
  if (!result.ok) return formError(result.error.message);
  revalidatePath("/app");
  redirect(contentPath(id));
}

export async function publishArticleAction(id: string): Promise<ContentActionState> {
  const { access, itemId } = await target(id, "publish");
  const result = await getAppContainer().publishContentItem.execute({ access, itemId });
  if (!result.ok) return formError(result.error.message);
  revalidatePath("/app");
  redirect(contentPath(id));
}
