import { z } from "zod";
import { parseJson, type BlogNetwork } from "../blog/blog-http";

export type WixNetwork = BlogNetwork & {
  /** Wix's REST address; a local stub in tests and E2E. */
  readonly apiBaseUrl?: string;
};

export const WIX_API = "https://www.wixapis.com/";

export const wixUrl = (network: WixNetwork, path: string) =>
  new URL(path, network.apiBaseUrl ?? WIX_API).toString();

/** An API key from the Wix API Keys Manager, scoped to one site by its ID. */
export const wixHeaders = (apiKey: string, siteId: string) => ({
  authorization: apiKey,
  "wix-site-id": siteId,
});

const errorBody = z.object({
  message: z.string().optional(),
  details: z
    .object({
      validationError: z
        .object({
          fieldViolations: z.array(z.object({ field: z.string(), description: z.string() })),
        })
        .optional(),
      applicationError: z.object({ description: z.string() }).optional(),
    })
    .optional(),
});

/** Wix's explanation: the first field violation, else the application error or message. */
export const wixMessage = (body: string): string | undefined => {
  const parsed = errorBody.safeParse(parseJson(body));
  if (!parsed.success) return undefined;
  const [violation] = parsed.data.details?.validationError?.fieldViolations ?? [];
  if (violation) return `${violation.field} ${violation.description}`;
  return parsed.data.details?.applicationError?.description ?? parsed.data.message;
};
