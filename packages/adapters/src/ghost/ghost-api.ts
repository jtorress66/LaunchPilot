import type { Clock } from "@nuvantre/ports";
import { z } from "zod";
import { parseJson, type BlogNetwork } from "../blog/blog-http";
import { ghostAdminToken, type GhostAdminKey } from "./ghost-admin-token";

export type GhostNetwork = BlogNetwork & { readonly clock: Clock };

/** The Admin API lives under the site's own address, e.g. `https://blog.acme.dev/ghost/api/admin/`. */
export const adminUrl = (siteUrl: string, path: string, query: Record<string, string> = {}) => {
  const url = new URL(`ghost/api/admin/${path}`, siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  return url.toString();
};

export const adminHeaders = (key: GhostAdminKey, clock: Clock) => ({
  authorization: `Ghost ${ghostAdminToken(key, clock.now())}`,
  "accept-version": "v5.0",
});

const errorBody = z.object({
  errors: z.array(z.object({ message: z.string(), context: z.string().nullish() })).min(1),
});

/** Ghost's explanation of a failure: the specific context when it gives one. */
export const ghostMessage = (body: string): string | undefined => {
  const parsed = errorBody.safeParse(parseJson(body));
  const [first] = parsed.success ? parsed.data.errors : [];
  return first?.context ?? first?.message;
};
