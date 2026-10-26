import { productId } from "@nuvantre/domain";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getAppContainer } from "../../../../../../container";
import { requireUser } from "../../../../../_lib/auth";
import { idParam } from "../../../../../_lib/params";

export const dynamic = "force-dynamic";

/** Where the provider's linking page sends the founder back: store what they linked. */
export async function GET(
  request: NextRequest,
  { params }: { readonly params: Promise<{ id: string }> },
) {
  const id = idParam((await params).id);
  const { workspace } = await requireUser();
  // The provider appends `error` when the founder cancelled or linking failed.
  if (request.nextUrl.searchParams.has("error")) redirect(`/app/products/${id}/social?linked=0`);
  const result = await getAppContainer().refreshSocialLinks.execute({
    workspace,
    productId: productId(id),
  });
  redirect(`/app/products/${id}/social${result.ok ? "?linked=1" : "?linked=0"}`);
}
