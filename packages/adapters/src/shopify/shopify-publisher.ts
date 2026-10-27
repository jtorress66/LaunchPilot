import {
  ok,
  parseHttpUrl,
  type ChannelConnection,
  type PublishableContentItem,
  type Result,
} from "@nuvantre/domain";
import type { Clock, PublishError, PublishReceipt, Publisher } from "@nuvantre/ports";
import { z } from "zod";
import {
  publishError as failure,
  publishFailureFor,
  sendFailure,
  type BlogNetwork,
} from "../blog/blog-http";
import { markdownToHtml } from "../blog/markdown-to-html";
import { shopifyGraphql } from "./shopify-graphql";

export interface ShopifyStore {
  readonly storeUrl: string;
  /** The decrypted Admin API access token; kept in memory only. */
  readonly accessToken: string;
  /** What the verifier looked up: blogId, blogHandle, publicUrl and author. */
  readonly settings: Readonly<Record<string, string>>;
}

const CREATE_ARTICLE = `mutation NuvantreCreateArticle($article: ArticleCreateInput!) {
  articleCreate(article: $article) {
    article { id handle isPublished }
    userErrors { field message code }
  }
}`;

const created = z.object({
  articleCreate: z.object({
    article: z.object({ handle: z.string().min(1) }).nullable(),
    userErrors: z.array(z.object({ message: z.string() })),
  }),
});

const reconnect = () =>
  failure("not_connected", "Shopify no longer accepts the saved token. Reconnect the blog.", false);

/** Publishes approved articles to a Shopify store's blog through the GraphQL Admin API. */
export class ShopifyPublisher implements Publisher {
  readonly channel = "blog" as const;

  constructor(
    private readonly store: ShopifyStore,
    private readonly network: BlogNetwork & { readonly clock: Clock },
  ) {}

  async publish(item: PublishableContentItem): Promise<Result<PublishReceipt, PublishError>> {
    const { blogId, blogHandle, publicUrl, author } = this.store.settings;
    if (!blogId || !blogHandle || !publicUrl) {
      return failure("not_connected", "Reconnect the Shopify store to choose its blog.", false);
    }
    const article = {
      blogId,
      title: item.title,
      body: markdownToHtml(item.body),
      isPublished: true,
      author: { name: author ?? "Nuvantre" },
      ...(item.seo ? { handle: item.seo.slug, summary: item.seo.excerpt } : {}),
    };
    const response = await shopifyGraphql(
      this.store.storeUrl,
      this.store.accessToken,
      { query: CREATE_ARTICLE, variables: { article } },
      this.network,
    );
    if (!response.ok) return sendFailure(response.error);
    const answer = response.value;
    if (answer.kind === "unauthorized" || answer.kind === "access_denied") return reconnect();
    if (answer.kind === "unavailable")
      return publishFailureFor("Shopify", answer.status, undefined);
    if (answer.kind === "not_shopify") return publishFailureFor("Shopify", 404, undefined);
    if (answer.kind === "failed") return publishFailureFor("Shopify", 400, answer.message);

    const result = created.safeParse(answer.data);
    if (!result.success) {
      return failure("unavailable", "Shopify answered in an unexpected way. Try again.", true);
    }
    const [userError] = result.data.articleCreate.userErrors;
    if (userError) return publishFailureFor("Shopify", 422, userError.message);
    const handle = result.data.articleCreate.article?.handle;
    const url = handle
      ? parseHttpUrl(new URL(`blogs/${blogHandle}/${handle}`, publicUrl).toString())
      : undefined;
    if (!url?.ok) {
      return failure("unavailable", "Shopify did not return the new article. Try again.", true);
    }
    return ok({
      channel: this.channel,
      externalUrl: url.value,
      publishedAt: this.network.clock.now(),
    });
  }
}

/** Builds the publisher for a stored Shopify connection and its decrypted access token. */
export const shopifyPublisherFactory =
  (network: BlogNetwork & { readonly clock: Clock }) =>
  (connection: ChannelConnection, accessToken: string): Publisher =>
    new ShopifyPublisher(
      { storeUrl: connection.siteUrl, accessToken, settings: connection.settings },
      network,
    );
