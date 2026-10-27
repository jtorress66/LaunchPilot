import { ok, type Result } from "@nuvantre/domain";
import type {
  BlogConnectionVerifier,
  BlogCredentials,
  ConnectionError,
  VerifiedBlog,
} from "@nuvantre/ports";
import { z } from "zod";
import { connectFailure, connectionError as failure, type BlogNetwork } from "../blog/blog-http";
import { shopifyGraphql } from "./shopify-graphql";

const SHOP_QUERY = `query NuvantreConnect {
  shop { name primaryDomain { url } }
  blogs(first: 50) { nodes { id handle title } }
}`;

const shopData = z.object({
  shop: z.object({ name: z.string().min(1), primaryDomain: z.object({ url: z.string().url() }) }),
  blogs: z.object({ nodes: z.array(z.object({ id: z.string(), handle: z.string() })) }),
});

const withSlash = (url: string) => (url.endsWith("/") ? url : `${url}/`);

/**
 * Checks a store and a custom app's Admin API access token, and picks the blog to publish to:
 * the one whose handle the founder gave, else the store's first.
 */
export class ShopifyConnectionVerifier implements BlogConnectionVerifier {
  constructor(private readonly network: BlogNetwork) {}

  async verify({
    siteUrl,
    settings,
    secret,
  }: BlogCredentials): Promise<Result<VerifiedBlog, ConnectionError>> {
    const response = await shopifyGraphql(siteUrl, secret, { query: SHOP_QUERY }, this.network);
    if (!response.ok) return connectFailure(response.error);
    const answer = response.value;
    if (answer.kind === "unauthorized") {
      return failure("invalid_credentials", "Shopify did not accept that access token");
    }
    if (answer.kind === "access_denied") {
      return failure(
        "invalid_credentials",
        "This access token cannot manage blog posts. Give the app the write_content scope.",
      );
    }
    if (answer.kind === "unavailable") {
      return failure("unreachable", "Shopify is unavailable. Try again.", true);
    }
    const shop = answer.kind === "data" ? shopData.safeParse(answer.data) : undefined;
    if (!shop?.success) return failure("wrong_platform", "This address is not a Shopify store");

    const blogs = shop.data.blogs.nodes;
    const wanted = settings.blogHandle;
    const blog = wanted ? blogs.find((b) => b.handle === wanted) : blogs[0];
    if (!blog) {
      return failure(
        "wrong_platform",
        wanted
          ? `This store has no blog with the handle "${wanted}"`
          : "This store has no blog yet. Add one under Online Store → Blog posts.",
      );
    }
    return ok({
      siteName: shop.data.shop.name,
      siteUrl: withSlash(new URL(siteUrl).origin),
      settings: {
        ...settings,
        blogId: blog.id,
        blogHandle: blog.handle,
        publicUrl: withSlash(shop.data.shop.primaryDomain.url),
        author: shop.data.shop.name,
      },
    });
  }
}
