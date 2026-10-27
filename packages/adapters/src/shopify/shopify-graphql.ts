import { ok, type Result } from "@nuvantre/domain";
import { z } from "zod";
import { blogHttpOptions, parseJson, type BlogNetwork } from "../blog/blog-http";
import { safeRequest, type HttpFailure } from "../net/safe-http";

/** Pinned GraphQL Admin API version; Shopify supports each for at least a year. */
export const SHOPIFY_API_VERSION = "2026-07";

/** How Shopify answered, reduced to what a verifier or publisher acts on. */
export type ShopifyAnswer =
  | { readonly kind: "data"; readonly data: unknown }
  | { readonly kind: "unauthorized" }
  | { readonly kind: "access_denied" }
  | { readonly kind: "not_shopify" }
  | { readonly kind: "unavailable"; readonly status: number }
  | { readonly kind: "failed"; readonly status: number; readonly message: string | undefined };

const graphqlBody = z.object({
  data: z.unknown().optional(),
  errors: z
    .union([
      z.string(),
      z.array(
        z.object({
          message: z.string(),
          extensions: z.object({ code: z.string().optional() }).optional(),
        }),
      ),
    ])
    .optional(),
});

const classify = (status: number, body: string): ShopifyAnswer => {
  if (status === 401 || status === 403) return { kind: "unauthorized" };
  if (status === 429 || status >= 500) return { kind: "unavailable", status };
  const parsed = graphqlBody.safeParse(parseJson(body));
  if (status === 404 || !parsed.success) return { kind: "not_shopify" };
  const { data, errors } = parsed.data;
  if (Array.isArray(errors) && errors.length > 0) {
    const codes = errors.map((error) => error.extensions?.code);
    if (codes.includes("ACCESS_DENIED")) return { kind: "access_denied" };
    // Shopify reports throttling inside a 200; treat it as the rate limit it is.
    if (codes.includes("THROTTLED")) return { kind: "unavailable", status: 429 };
    return { kind: "failed", status, message: errors[0]?.message };
  }
  if (status !== 200 || data === undefined || data === null) {
    return { kind: "failed", status, message: typeof errors === "string" ? errors : undefined };
  }
  return { kind: "data", data };
};

/** One call to the store's GraphQL Admin API with a custom app's Admin API access token. */
export const shopifyGraphql = async (
  storeUrl: string,
  accessToken: string,
  request: { readonly query: string; readonly variables?: Readonly<Record<string, unknown>> },
  network: BlogNetwork,
): Promise<Result<ShopifyAnswer, HttpFailure>> => {
  const endpoint = new URL(`/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, storeUrl).toString();
  const response = await safeRequest(
    endpoint,
    {
      method: "POST",
      headers: { "x-shopify-access-token": accessToken, "content-type": "application/json" },
      body: JSON.stringify(request),
    },
    blogHttpOptions(network),
  );
  if (!response.ok) return response;
  return ok(classify(response.value.status, response.value.body));
};
