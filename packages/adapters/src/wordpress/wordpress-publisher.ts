import { err, ok, parseHttpUrl, type PublishableContentItem, type Result } from "@nuvantre/domain";
import type { Clock, PublishError, PublishReceipt, Publisher } from "@nuvantre/ports";
import { z } from "zod";
import { safeRequest } from "../net/safe-http";
import { markdownToHtml } from "./markdown-to-html";
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

const failure = (code: PublishError["code"], message: string, retryable: boolean) =>
  err<PublishError>({ code, message, retryable });

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
        }),
      },
      httpOptions(this.options),
    );
    if (!response.ok) {
      return response.error.reason === "blocked"
        ? failure("not_connected", "The blog's address cannot be used. Reconnect the blog.", false)
        : failure("unavailable", "The blog could not be reached. Try again.", true);
    }
    const { status, body } = response.value;
    if (status === 401 || status === 403) {
      return failure(
        "not_connected",
        "WordPress no longer accepts the saved Application Password. Reconnect the blog.",
        false,
      );
    }
    if (status >= 300 && status < 400) {
      return failure(
        "rejected_by_platform",
        "The blog moved to a new address. Reconnect it with its current address.",
        false,
      );
    }
    if (status === 429 || status >= 500) {
      return failure("unavailable", `WordPress is unavailable (HTTP ${status}). Try again.`, true);
    }
    if (status !== 200 && status !== 201) {
      const reason = wordPressMessage(body) ?? `HTTP ${status}`;
      return failure("rejected_by_platform", `WordPress rejected the post: ${reason}`, false);
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
