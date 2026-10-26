"use server";

import { productId, taskId } from "@nuvantre/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppContainer } from "../../container";
import {
  blogConnectionForm,
  parseForm,
  seedKeywordsForm,
  type FieldErrors,
} from "../../server/forms";
import { draftFailureMessage, keywordFailureMessage } from "../../server/messages";
import { requireUser } from "./auth";
import { idParam } from "./params";

export interface SeoActionState {
  readonly errors?: FieldErrors;
  readonly connected?: string;
}

const seoPath = (id: string) => `/app/products/${id}/seo`;
const formError = (message: string): SeoActionState => ({ errors: { form: message } });

export async function connectBlogAction(
  id: string,
  _state: SeoActionState,
  data: FormData,
): Promise<SeoActionState> {
  const { workspace } = await requireUser();
  const form = parseForm(blogConnectionForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().connectBlog.execute({
    workspace,
    productId: productId(idParam(id)),
    ...form.value,
  });
  if (!result.ok) return formError(result.error.message);
  revalidatePath(seoPath(id));
  return { connected: result.value.siteName };
}

export async function planSeoAction(
  id: string,
  _state: SeoActionState,
  data: FormData,
): Promise<SeoActionState> {
  const { workspace } = await requireUser();
  const form = parseForm(seedKeywordsForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().planSeoContent.execute({
    workspace,
    productId: productId(idParam(id)),
    seeds: form.value.seeds,
  });
  if (!result.ok) return formError(keywordFailureMessage(result.error));
  revalidatePath(seoPath(id));
  return {};
}

export async function draftArticleAction(id: string): Promise<SeoActionState> {
  const { workspace } = await requireUser();
  const result = await getAppContainer().draftSeoArticle.execute({
    workspace,
    taskId: taskId(idParam(id)),
  });
  if (!result.ok) return formError(draftFailureMessage(result.error));
  revalidatePath("/app");
  redirect(`/app/content/${result.value.id}`);
}
