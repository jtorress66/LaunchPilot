export const SESSION_COOKIE = "lp_session";

/** Over HTTPS the __Host- prefix stops subdomains and other paths from setting or shadowing it. */
const SECURE_SESSION_COOKIE = `__Host-${SESSION_COOKIE}`;

/** The name a session cookie is written under for this app URL. */
export const sessionCookieName = (appUrl: string): string =>
  appUrl.startsWith("https://") ? SECURE_SESSION_COOKIE : SESSION_COOKIE;

/** Every name a session may be read from, the current one first. */
export const sessionCookieNames: readonly string[] = [SECURE_SESSION_COOKIE, SESSION_COOKIE];

export const sessionCookieOptions = (appUrl: string, expiresAt: Date) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: appUrl.startsWith("https://"),
  path: "/",
  expires: expiresAt,
});
