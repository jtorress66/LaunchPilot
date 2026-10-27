import {
  ok,
  parseHttpUrl,
  type ChannelConnection,
  type PublishableContentItem,
  type Result,
} from "@nuvantre/domain";
import type { Clock, PublishError, PublishReceipt, Publisher } from "@nuvantre/ports";
import { z } from "zod";
import { publishError as failure, publishFailureFor, sendFailure } from "../blog/blog-http";
import { safeRequest } from "../net/safe-http";
import { markdownToHtml } from "../blog/markdown-to-html";
import {
  basicAuth,
  httpOptions,
  parseJson,
  restUrl,
  wordPressMessage,
  type WordPressNetwork,
} from "./rest";

export interface WordPressSite {
  readonly siteUrl: string;
  readonly username: string;
  /** The decrypted Application Password; kept in memory only. */
  readonly password: string;
}

const createdPost = z.object({ link: z.string() });

/** Publishes approved articles to a founder's WordPress blog through its official REST API. */
export class WordPressPublisher implements Publisher {
  readonly channel = "blog" as const;

  constructor(
    private readonly site: WordPressSite,
    private readonly options: WordPressNetwork & { readonly clock: Clock },
  ) {}

  async publish(item: PublishableContentItem): Promise<Result<PublishReceipt, PublishError>> {
    const response = await safeRequest(
      restUrl(this.site.siteUrl, "/wp/v2/posts"),
      {
        method: "POST",
        headers: {
          authorization: basicAuth(this.site.username, this.site.password),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: item.title,
          content: markdownToHtml(item.body),
          status: "publish",
          // WordPress shows the excerpt in post lists and many themes' meta descriptions.
          ...(item.seo ? { slug: item.seo.slug, excerpt: item.seo.excerpt } : {}),
        }),
      },
      httpOptions(this.options),
    );
    if (!response.ok) return sendFailure(response.error);
    const { status, body } = response.value;
    if (status !== 200 && status !== 201) {
      return publishFailureFor("WordPress", status, wordPressMessage(body));
    }
    const post = createdPost.safeParse(parseJson(body));
    const link = post.success ? parseHttpUrl(post.data.link) : undefined;
    if (!link?.ok) {
      return failure("unavailable", "WordPress did not return the new post's address", true);
    }
    return ok({
      channel: this.channel,
      externalUrl: link.value,
      publishedAt: this.options.clock.now(),
    });
  }
}

/** Builds the publisher for a stored WordPress connection and its decrypted password. */
export const wordPressPublisherFactory =
  (options: WordPressNetwork & { readonly clock: Clock }) =>
  (connection: ChannelConnection, password: string): Publisher =>
    new WordPressPublisher(
      { siteUrl: connection.siteUrl, username: connection.settings.username ?? "", password },
      options,
    );
