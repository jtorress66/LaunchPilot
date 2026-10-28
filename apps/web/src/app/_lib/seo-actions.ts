"use server";

import { describeLocale, productId, taskId } from "@nuvantre/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppContainer } from "../../container";
import {
  blogConnectionFormFor,
  blogPlatformForm,
  localeForm,
  parseForm,
  seedKeywordsForm,
  type FieldErrors,
} from "../../server/forms";
import { draftFailureMessage, keywordFailureMessage } from "../../server/messages";
import { refusedByLimit } from "./limits";
import { requireAccess } from "./auth";
import { idParam } from "./params";

export interface SeoActionState {
  readonly errors?: FieldErrors;
  readonly connected?: string;
  /** Confirmation after the language and market are saved. */
  readonly saved?: string;
}

const seoPath = (id: string) => `/app/products/${id}/seo`;
const formError = (message: string): SeoActionState => ({ errors: { form: message } });

export async function connectBlogAction(
  id: string,
  _state: SeoActionState,
  data: FormData,
): Promise<SeoActionState> {
  const { workspace } = await requireAccess("connect");
  const choice = parseForm(blogPlatformForm, data);
  if (!choice.ok) return { errors: choice.error };
  const form = parseForm(blogConnectionFormFor(choice.value.platform), data);
  if (!form.ok) return { errors: form.error };
  const limitedConnect = await refusedByLimit("connect", workspace.id);
  if (limitedConnect) return formError(limitedConnect);
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
  const { workspace } = await requireAccess("draft");
  const form = parseForm(seedKeywordsForm, data);
  if (!form.ok) return { errors: form.error };
  const limitedPlan = await refusedByLimit("draft", workspace.id);
  if (limitedPlan) return formError(limitedPlan);
  const result = await getAppContainer().planSeoContent.execute({
    workspace,
    productId: productId(idParam(id)),
    seeds: form.value.seeds,
  });
  if (!result.ok) return formError(keywordFailureMessage(result.error));
  revalidatePath(seoPath(id));
  return {};
}

export async function setLocaleAction(
  id: string,
  _state: SeoActionState,
  data: FormData,
): Promise<SeoActionState> {
  const { workspace } = await requireAccess("manage_products");
  const form = parseForm(localeForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().setProductLocale.execute({
    workspace,
    productId: productId(idParam(id)),
    locale: form.value.locale,
  });
  if (!result.ok) return formError(result.error.message);
  revalidatePath(seoPath(id));
  return { saved: `Articles and posts are now written in ${describeLocale(result.value.locale)}.` };
}

export async function draftArticleAction(id: string): Promise<SeoActionState> {
  const { workspace } = await requireAccess("draft");
  const limited = await refusedByLimit("draft", workspace.id);
  if (limited) return formError(limited);
  const result = await getAppContainer().draftSeoArticle.execute({
    workspace,
    taskId: taskId(idParam(id)),
  });
  if (!result.ok) return formError(draftFailureMessage(result.error));
  revalidatePath("/app");
  redirect(`/app/content/${result.value.id}`);
}
