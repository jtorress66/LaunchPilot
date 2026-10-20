import { productId } from "@launchpilot/domain";
import { NextResponse, type NextRequest } from "next/server";
import { getAppContainer } from "../../../../container";
import {
  GOOGLE_STATE_COOKIE,
  googleStateCookieOptions,
} from "../../../../server/oauth-state-cookie";
import { requireUser } from "../../../_lib/auth";
import { idParam } from "../../../_lib/params";

export const dynamic = "force-dynamic";

/** "Connect Google": remembers a fresh state in a short-lived cookie, then goes to Google. */
export async function GET(request: NextRequest) {
  const id = idParam(request.nextUrl.searchParams.get("product") ?? "");
  const { workspace } = await requireUser();
  const app = getAppContainer();
  const back = new URL(`/app/products/${id}/analytics`, app.appUrl);
  if (!app.analytics.google) {
    back.searchParams.set("google", "unconfigured");
    return NextResponse.redirect(back);
  }
  const started = await app.analytics.google.start.execute({ workspace, productId: productId(id) });
  if (!started.ok) {
    back.searchParams.set("google", started.error.code);
    return NextResponse.redirect(back);
  }
  const response = NextResponse.redirect(started.value.url);
  response.cookies.set(
    GOOGLE_STATE_COOKIE,
    JSON.stringify({ state: started.value.state, productId: id }),
    googleStateCookieOptions(app.appUrl),
  );
  return response;
}
