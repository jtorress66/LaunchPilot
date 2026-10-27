import { z } from "zod";
import { parseJson, type BlogNetwork } from "../blog/blog-http";

export type WebflowNetwork = BlogNetwork & {
  /** The Data API's address; a local stub in tests and E2E. */
  readonly apiBaseUrl?: string;
};

export const WEBFLOW_API = "https://api.webflow.com/";

export const webflowUrl = (network: WebflowNetwork, path: string) =>
  new URL(path, network.apiBaseUrl ?? WEBFLOW_API).toString();

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

const errorBody = z.object({
  message: z.string(),
  details: z.array(z.object({ param: z.string().optional(), description: z.string() })).optional(),
});

/** Webflow's explanation: the first field-level detail when it gives one. */
export const webflowMessage = (body: string): string | undefined => {
  const parsed = errorBody.safeParse(parseJson(body));
  if (!parsed.success) return undefined;
  const [detail] = parsed.data.details ?? [];
  if (!detail) return parsed.data.message;
  return detail.param ? `${detail.param}: ${detail.description}` : detail.description;
};
