"use server";

import { contentItemId, productId, socialChannels } from "@nuvantre/domain";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAppContainer } from "../../container";
import { parseForm, postForm, scheduleForm, type FieldErrors } from "../../server/forms";
import {
  draftFailureMessage,
  publishFailureMessage,
  socialFailureMessage,
} from "../../server/messages";
import { requireUser } from "./auth";
import { idParam } from "./params";

export interface SocialActionState {
  readonly errors?: FieldErrors;
  /** Shown after drafting stops at the plan's monthly allowance. */
  readonly notice?: string;
}

const socialPath = (id: string) => `/app/products/${id}/social`;
const contentPath = (id: string) => `/app/content/${id}`;
const formError = (message: string): SocialActionState => ({ errors: { form: message } });

/** Sends the founder to the provider's page to link one channel; they come back to /linked. */
export async function connectSocialAction(id: string, channel: string): Promise<SocialActionState> {
  const { workspace } = await requireUser();
  // Bound arguments arrive from the browser, so the channel is validated like any input.
  const social = socialChannels.find((c) => c === channel);
  if (!social) notFound();
  const app = getAppContainer();
  const result = await app.connectSocial.execute({
    workspace,
    productId: productId(idParam(id)),
    channel: social,
    returnUrl: `${app.appUrl}${socialPath(id)}/linked`,
  });
  if (!result.ok) return formError(socialFailureMessage(result.error));
  redirect(result.value.url);
}

export async function draftSocialWeekAction(id: string): Promise<SocialActionState> {
  const { workspace } = await requireUser();
  const result = await getAppContainer().draftSocialWeek.execute({
    workspace,
    productId: productId(idParam(id)),
  });
  if (!result.ok) return formError(draftFailureMessage(result.error));
  revalidatePath("/app", "layout");
  return result.value.stoppedAtLimit
    ? {
        notice: `Drafted ${String(result.value.items.length)} posts: your plan's monthly allowance is used up.`,
      }
    : {};
}

export async function savePostAction(
  id: string,
  _state: SocialActionState,
  data: FormData,
): Promise<SocialActionState> {
  const { workspace } = await requireUser();
  const form = parseForm(postForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().reviseContentItem.execute({
    workspace,
    itemId: contentItemId(idParam(id)),
    body: form.value.body,
  });
  if (!result.ok) return { errors: { body: result.error.message } };
  redirect(`${contentPath(id)}?saved=1`);
}

export async function schedulePostAction(
  id: string,
  _state: SocialActionState,
  data: FormData,
): Promise<SocialActionState> {
  const { workspace } = await requireUser();
  const form = parseForm(scheduleForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().schedulePost.execute({
    workspace,
    itemId: contentItemId(idParam(id)),
    publishAt: form.value.publishAt,
  });
  if (!result.ok) return { errors: { publishAt: result.error.message } };
  revalidatePath("/app", "layout");
  redirect(contentPath(id));
}

export async function unschedulePostAction(id: string): Promise<SocialActionState> {
  const { workspace } = await requireUser();
  const result = await getAppContainer().unschedulePost.execute({
    workspace,
    itemId: contentItemId(idParam(id)),
  });
  if (!result.ok) return formError(result.error.message);
  revalidatePath("/app", "layout");
  redirect(contentPath(id));
}

export async function publishPostAction(id: string): Promise<SocialActionState> {
  const { workspace } = await requireUser();
  const result = await getAppContainer().publishContentItem.execute({
    workspace,
    itemId: contentItemId(idParam(id)),
  });
  if (!result.ok) return formError(publishFailureMessage(result.error));
  revalidatePath("/app", "layout");
  redirect(contentPath(id));
}

/** Approves straight from the inbox, which then shows the next item. */
export async function approveFromInboxAction(id: string): Promise<SocialActionState> {
  const { user, workspace } = await requireUser();
  const result = await getAppContainer().approveContentItem.execute({
    workspace,
    itemId: contentItemId(idParam(id)),
    actor: { kind: "founder", userId: user.id },
  });
  if (!result.ok) return formError(result.error.message);
  revalidatePath("/app", "layout");
  return {};
}
