import { z } from "zod";

/** Holds the OAuth `state` (and the product) between "Connect Google" and Google's callback. */
export const GOOGLE_STATE_COOKIE = "lp_google_oauth";

const TEN_MINUTES = 600;

export const googleStateCookieOptions = (appUrl: string) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: appUrl.startsWith("https://"),
  path: "/api/google",
  maxAge: TEN_MINUTES,
});

const stateValue = z.object({ state: z.string().min(1), productId: z.string().min(1) });

export type GoogleState = z.infer<typeof stateValue>;

/** The cookie's value, or null when it is missing or not ours. */
export const readGoogleState = (value: string | undefined): GoogleState | null => {
  if (value === undefined) return null;
  try {
    const parsed = stateValue.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
