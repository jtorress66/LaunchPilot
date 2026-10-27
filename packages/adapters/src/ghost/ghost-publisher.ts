import {
  ok,
  parseHttpUrl,
  type ChannelConnection,
  type PublishableContentItem,
  type Result,
} from "@nuvantre/domain";
import type { PublishError, PublishReceipt, Publisher } from "@nuvantre/ports";
import { z } from "zod";
import {
  blogHttpOptions,
  parseJson,
  publishError as failure,
  publishFailureFor,
  sendFailure,
} from "../blog/blog-http";
import { markdownToHtml } from "../blog/markdown-to-html";
import { safeRequest } from "../net/safe-http";
import { parseGhostAdminKey } from "./ghost-admin-token";
import { adminHeaders, adminUrl, ghostMessage, type GhostNetwork } from "./ghost-api";

export interface GhostSite {
  readonly siteUrl: string;
  /** The decrypted Admin API key; kept in memory only. */
  readonly adminKey: string;
}

const createdPost = z.object({ posts: z.array(z.object({ url: z.string() })).min(1) });

/** Publishes approved articles to a founder's Ghost site through its official Admin API. */
export class GhostPublisher implements Publisher {
  readonly channel = "blog" as const;

  constructor(
    private readonly site: GhostSite,
    private readonly network: GhostNetwork,
  ) {}

  async publish(item: PublishableContentItem): Promise<Result<PublishReceipt, PublishError>> {
    const key = parseGhostAdminKey(this.site.adminKey);
    if (!key) {
      return failure(
        "not_connected",
        "The saved Ghost key is not valid. Reconnect the blog.",
        false,
      );
    }
    const response = await safeRequest(
      adminUrl(this.site.siteUrl, "posts/", { source: "html" }),
      {
        method: "POST",
        headers: { ...adminHeaders(key, this.network.clock), "content-type": "application/json" },
        body: JSON.stringify({
          posts: [
            {
              title: item.title,
              html: markdownToHtml(item.body),
              status: "published",
              ...(item.seo ? { slug: item.seo.slug, custom_excerpt: item.seo.excerpt } : {}),
            },
          ],
        }),
      },
      blogHttpOptions(this.network),
    );
    if (!response.ok) return sendFailure(response.error);
    const { status, body } = response.value;
    if (status !== 200 && status !== 201) {
      return publishFailureFor("Ghost", status, ghostMessage(body));
    }
    const post = createdPost.safeParse(parseJson(body));
    const url = post.success ? parseHttpUrl(post.data.posts[0]?.url ?? "") : undefined;
    if (!url?.ok)
      return failure("unavailable", "Ghost did not return the new post's address", true);
    return ok({
      channel: this.channel,
      externalUrl: url.value,
      publishedAt: this.network.clock.now(),
    });
  }
}

/** Builds the publisher for a stored Ghost connection and its decrypted Admin API key. */
export const ghostPublisherFactory =
  (network: GhostNetwork) =>
  (connection: ChannelConnection, adminKey: string): Publisher =>
    new GhostPublisher({ siteUrl: connection.siteUrl, adminKey }, network);
