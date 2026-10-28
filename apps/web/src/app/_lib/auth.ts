import "server-only";
import type { Session, WorkspaceAction } from "@nuvantre/domain";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAppContainer } from "../../container";
import { allowedOrNull } from "../../server/access";
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

/** The signed-in person, or null: for public pages that change when someone is signed in. */
export const currentUser = cache(async () => {
  const token = await readSessionToken();
  if (!token) return null;
  const result = await getAppContainer().authenticate.execute(token);
  return result.ok ? result.value : null;
});

/**
 * The signed-in person, when their role in the current workspace allows the action. Every
 * server action that changes anything calls this; a client viewer is sent back to the dashboard.
 */
export const requireAccess = async (action: WorkspaceAction) => {
  const access = allowedOrNull(await requireUser(), action);
  if (!access) redirect("/app?denied=1");
  return access;
};

/** The current session's token, for actions that change the session itself. */
export const currentSessionToken = readSessionToken;

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
