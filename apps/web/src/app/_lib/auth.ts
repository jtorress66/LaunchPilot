import "server-only";
import type { Session } from "@nuvantre/domain";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAppContainer } from "../../container";
import { SESSION_COOKIE, sessionCookieOptions } from "../../server/session-cookie";

/** The signed-in founder and workspace, or a redirect to the login page. Cached per request. */
export const requireUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login");
  const result = await getAppContainer().authenticate.execute(token);
  if (!result.ok) redirect("/login?expired=1");
  return result.value;
});

export const setSessionCookie = async (session: Session): Promise<void> => {
  (await cookies()).set(
    SESSION_COOKIE,
    session.token,
    sessionCookieOptions(getAppContainer().appUrl, session.expiresAt),
  );
};

export const takeSessionCookie = async (): Promise<string | undefined> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  return token;
};
