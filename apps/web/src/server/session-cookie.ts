export const SESSION_COOKIE = "lp_session";

export const sessionCookieOptions = (appUrl: string, expiresAt: Date) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: appUrl.startsWith("https://"),
  path: "/",
  expires: expiresAt,
});
