import { z } from "zod";
import type { SafeHttpOptions } from "../net/safe-http";

export const WORDPRESS_USER_AGENT = "Nuvantre/1.0 (+https://nuvantre.app)";

export interface WordPressNetwork {
  /** Development and test only: lets Nuvantre reach a blog on localhost or a LAN. */
  readonly allowPrivateNetwork: boolean;
  readonly timeoutMs?: number;
}

export const httpOptions = ({
  allowPrivateNetwork,
  timeoutMs,
}: WordPressNetwork): SafeHttpOptions => ({
  policy: { allowPrivateNetwork },
  userAgent: WORDPRESS_USER_AGENT,
  timeoutMs: timeoutMs ?? 15_000,
  maxBytes: 1_000_000,
});

/**
 * `?rest_route=` reaches the REST API whatever the site's permalink settings,
 * unlike `/wp-json/`, which needs pretty permalinks.
 */
export const restUrl = (siteUrl: string, route: string, params: Record<string, string> = {}) => {
  const url = new URL(siteUrl);
  url.searchParams.set("rest_route", route);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.href;
};

/** Application Passwords use HTTP Basic auth. The header is never logged. */
export const basicAuth = (username: string, password: string) =>
  `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

export const parseJson = (body: string): unknown => {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
};

const wpError = z.object({ message: z.string() });

/** WordPress's own explanation of an error, which never contains credentials. */
export const wordPressMessage = (body: string): string | undefined => {
  const parsed = wpError.safeParse(parseJson(body));
  return parsed.success ? parsed.data.message : undefined;
};
