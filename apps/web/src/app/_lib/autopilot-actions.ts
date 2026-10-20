"use server";

import { productId } from "@launchpilot/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppContainer } from "../../container";
import { requireUser } from "./auth";
import { idParam } from "./params";

export interface AutopilotActionState {
  readonly error?: string;
}

const analyticsPath = (id: string) => `/app/products/${id}/analytics`;

/** Bound arguments arrive from the browser, so `enabled` is checked like any input. */
export async function setAutopilotAction(rawId: string, enabled: unknown): Promise<void> {
  const id = idParam(rawId);
  const { workspace } = await requireUser();
  await getAppContainer().setAutopilot.execute({
    workspace,
    productId: productId(id),
    enabled: enabled === true,
  });
  revalidatePath(analyticsPath(id));
  revalidatePath("/app");
}

export async function runAutopilotNowAction(rawId: string): Promise<AutopilotActionState> {
  const id = idParam(rawId);
  const { workspace } = await requireUser();
  const result = await getAppContainer().runAutopilotNow.execute({
    workspace,
    productId: productId(id),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath(analyticsPath(id));
  revalidatePath("/app", "layout");
  redirect(`${analyticsPath(id)}?autopilot=ran#autopilot`);
}
