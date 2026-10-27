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
  blogHttpOptions,
  parseJson,
  publishError as failure,
  publishFailureFor,
  sendFailure,
} from "../blog/blog-http";
import { markdownToRicos } from "../blog/markdown-to-ricos";
import { safeRequest } from "../net/safe-http";
import { wixHeaders, wixMessage, wixUrl, type WixNetwork } from "./wix-api";

export interface WixSite {
  readonly siteUrl: string;
  /** The decrypted API key; kept in memory only. */
  readonly apiKey: string;
  /** siteId, and memberId when the site needs posts owned by a member. */
  readonly settings: Readonly<Record<string, string>>;
}

const createdPost = z.object({
  draftPost: z.object({
    seoSlug: z.string().min(1).optional(),
    url: z.object({ base: z.string(), path: z.string() }).optional(),
  }),
});

/** Publishes approved articles to a Wix site's blog: a draft post created with `publish: true`. */
export class WixPublisher implements Publisher {
  readonly channel = "blog" as const;

  constructor(
    private readonly site: WixSite,
    private readonly network: WixNetwork & { readonly clock: Clock },
  ) {}

  async publish(item: PublishableContentItem): Promise<Result<PublishReceipt, PublishError>> {
    const { siteId, memberId } = this.site.settings;
    if (!siteId) return failure("not_connected", "Reconnect the Wix site with its site ID.", false);
    const draftPost = {
      title: item.title,
      richContent: markdownToRicos(item.body),
      ...(memberId ? { memberId } : {}),
      ...(item.seo ? { seoSlug: item.seo.slug, excerpt: item.seo.excerpt } : {}),
    };
    const response = await safeRequest(
      wixUrl(this.network, "blog/v3/draft-posts"),
      {
        method: "POST",
        headers: { ...wixHeaders(this.site.apiKey, siteId), "content-type": "application/json" },
        body: JSON.stringify({ draftPost, publish: true, fieldsets: ["URL"] }),
      },
      blogHttpOptions(this.network),
    );
    if (!response.ok) return sendFailure(response.error);
    const { status, body } = response.value;
    if (status !== 200 && status !== 201) {
      return publishFailureFor("Wix", status, wixMessage(body));
    }
    const created = createdPost.safeParse(parseJson(body));
    const url = created.success ? this.postUrl(created.data.draftPost) : undefined;
    if (!url?.ok) return failure("unavailable", "Wix did not return the new post's address", true);
    return ok({
      channel: this.channel,
      externalUrl: url.value,
      publishedAt: this.network.clock.now(),
    });
  }

  private postUrl({ url, seoSlug }: z.infer<typeof createdPost>["draftPost"]) {
    if (url) return parseHttpUrl(`${url.base}${url.path}`);
    return seoSlug
      ? parseHttpUrl(new URL(`post/${seoSlug}`, this.site.siteUrl).toString())
      : undefined;
  }
}

/** Builds the publisher for a stored Wix connection and its decrypted API key. */
export const wixPublisherFactory =
  (network: WixNetwork & { readonly clock: Clock }) =>
  (connection: ChannelConnection, apiKey: string): Publisher =>
    new WixPublisher(
      { siteUrl: connection.siteUrl, apiKey, settings: connection.settings },
      network,
    );
