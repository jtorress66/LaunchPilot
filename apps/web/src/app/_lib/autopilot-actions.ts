"use server";

import { productId } from "@nuvantre/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppContainer } from "../../container";
import { refusedByLimit } from "./limits";
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
  const limited = await refusedByLimit("draft", workspace.id);
  if (limited) return { error: limited };
  const result = await getAppContainer().runAutopilotNow.execute({
    workspace,
    productId: productId(id),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath(analyticsPath(id));
  revalidatePath("/app", "layout");
  const { outcome } = result.value;
  if (outcome.kind !== "completed") return { error: outcome.reason };
  redirect(`${analyticsPath(id)}?autopilot=ran#autopilot`);
}
