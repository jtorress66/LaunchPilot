import "server-only";
import type { Session } from "@nuvantre/domain";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAppContainer } from "../../container";
import {
  sessionCookieName,
  sessionCookieNames,
  sessionCookieOptions,
} from "../../server/session-cookie";

/** The session token, from the __Host- cookie or one set before the prefix. */
const readSessionToken = async (): Promise<string | undefined> => {
  const store = await cookies();
  return sessionCookieNames.map((name) => store.get(name)?.value).find(Boolean);
};

/** The signed-in founder and workspace, or a redirect to the login page. Cached per request. */
export const requireUser = cache(async () => {
  const token = await readSessionToken();
  if (!token) redirect("/login");
  const result = await getAppContainer().authenticate.execute(token);
  if (!result.ok) redirect("/login?expired=1");
  return result.value;
});

export const setSessionCookie = async (session: Session): Promise<void> => {
  const { appUrl } = getAppContainer();
  (await cookies()).set(
    sessionCookieName(appUrl),
    session.token,
    sessionCookieOptions(appUrl, session.expiresAt),
  );
};

export const takeSessionCookie = async (): Promise<string | undefined> => {
  const token = await readSessionToken();
  const store = await cookies();
  for (const name of sessionCookieNames) store.delete(name);
  return token;
};
