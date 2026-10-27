import { z } from "zod";
import { parseJson, type BlogNetwork } from "../blog/blog-http";

export { blogHttpOptions as httpOptions, parseJson } from "../blog/blog-http";

/** Kept for callers that still name it after WordPress. */
export type WordPressNetwork = BlogNetwork;

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

const wpError = z.object({ message: z.string() });

/** WordPress's own explanation of an error, which never contains credentials. */
export const wordPressMessage = (body: string): string | undefined => {
  const parsed = wpError.safeParse(parseJson(body));
  return parsed.success ? parsed.data.message : undefined;
};
