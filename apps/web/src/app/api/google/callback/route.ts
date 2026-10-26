import { productId } from "@nuvantre/domain";
import { NextResponse, type NextRequest } from "next/server";
import { getAppContainer } from "../../../../container";
import { GOOGLE_STATE_COOKIE, readGoogleState } from "../../../../server/oauth-state-cookie";
import { requireUser } from "../../../_lib/auth";
import { idParam } from "../../../_lib/params";

export const dynamic = "force-dynamic";

/** Google's redirect after consent: checks the state, stores the grant, returns to Analytics. */
export async function GET(request: NextRequest) {
  const app = getAppContainer();
  const saved = readGoogleState(request.cookies.get(GOOGLE_STATE_COOKIE)?.value);
  if (!saved) return NextResponse.redirect(new URL("/app", app.appUrl));
  const id = idParam(saved.productId);
  const { workspace } = await requireUser();
  const query = request.nextUrl.searchParams;
  const back = new URL(`/app/products/${id}/analytics`, app.appUrl);

  // Google appends `error` (e.g. access_denied) when the founder declined.
  if (query.has("error") || !app.analytics.google) {
    back.searchParams.set("google", query.has("error") ? "denied" : "unconfigured");
  } else {
    const result = await app.analytics.google.complete.execute({
      workspace,
      productId: productId(id),
      code: query.get("code") ?? "",
      state: query.get("state") ?? "",
      expectedState: saved.state,
    });
    back.searchParams.set("google", result.ok ? "connected" : result.error.code);
  }
  const response = NextResponse.redirect(back);
  response.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/google" });
  return response;
}
