"use server";

import { productId } from "@nuvantre/domain";
import { revalidatePath } from "next/cache";
import { getAppContainer } from "../../container";
import { parseForm, swapProductForm, type FieldErrors } from "../../server/forms";
import { requireAccess } from "./auth";
import { idParam } from "./params";

export interface ProductActionState {
  readonly errors?: FieldErrors;
}

const refresh = () => {
  revalidatePath("/app", "layout");
};

export async function archiveProductAction(id: string): Promise<ProductActionState> {
  const { workspace } = await requireAccess("manage_products");
  const result = await getAppContainer().archiveProduct.execute({
    workspace,
    productId: productId(idParam(id)),
  });
  if (!result.ok) return { errors: { form: result.error.message } };
  refresh();
  return {};
}

export async function restoreProductAction(id: string): Promise<ProductActionState> {
  const { workspace } = await requireAccess("manage_products");
  const result = await getAppContainer().restoreProduct.execute({
    workspace,
    productId: productId(idParam(id)),
  });
  if (!result.ok) return { errors: { form: result.error.message } };
  refresh();
  return {};
}

export async function makeProductActiveAction(
  id: string,
  _state: ProductActionState,
  data: FormData,
): Promise<ProductActionState> {
  const { workspace } = await requireAccess("manage_products");
  const form = parseForm(swapProductForm, data);
  if (!form.ok) return { errors: form.error };
  const result = await getAppContainer().swapActiveProduct.execute({
    workspace,
    activate: productId(idParam(id)),
    pause: productId(form.value.pause),
  });
  if (!result.ok) return { errors: { form: result.error.message } };
  refresh();
  return {};
}
