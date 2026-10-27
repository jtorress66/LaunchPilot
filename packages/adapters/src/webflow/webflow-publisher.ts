import {
  ok,
  parseHttpUrl,
  slugify,
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
import { markdownToHtml } from "../blog/markdown-to-html";
import { safeRequest } from "../net/safe-http";
import { bearer, webflowMessage, webflowUrl, type WebflowNetwork } from "./webflow-api";

export interface WebflowSite {
  readonly siteUrl: string;
  /** The decrypted site API token; kept in memory only. */
  readonly token: string;
  /** What the verifier found: collectionId, collectionSlug, bodyField and maybe summaryField. */
  readonly settings: Readonly<Record<string, string>>;
}

const createdItem = z.object({ fieldData: z.object({ slug: z.string().min(1) }) });

/** Publishes approved articles as live items in a Webflow site's blog collection (Data API v2). */
export class WebflowPublisher implements Publisher {
  readonly channel = "blog" as const;

  constructor(
    private readonly site: WebflowSite,
    private readonly network: WebflowNetwork & { readonly clock: Clock },
  ) {}

  async publish(item: PublishableContentItem): Promise<Result<PublishReceipt, PublishError>> {
    const { collectionId, collectionSlug, bodyField, summaryField } = this.site.settings;
    if (!collectionId || !collectionSlug || !bodyField) {
      return failure("not_connected", "Reconnect the Webflow site to find its blog fields.", false);
    }
    const fieldData = {
      name: item.title,
      slug: item.seo?.slug ?? slugify(item.title),
      [bodyField]: markdownToHtml(item.body),
      ...(summaryField && item.seo ? { [summaryField]: item.seo.excerpt } : {}),
    };
    const response = await safeRequest(
      webflowUrl(this.network, `v2/collections/${encodeURIComponent(collectionId)}/items/live`),
      {
        method: "POST",
        headers: { ...bearer(this.site.token), "content-type": "application/json" },
        body: JSON.stringify({ isArchived: false, isDraft: false, fieldData }),
      },
      blogHttpOptions(this.network),
    );
    if (!response.ok) return sendFailure(response.error);
    const { status, body } = response.value;
    if (status !== 200 && status !== 201 && status !== 202) {
      return publishFailureFor("Webflow", status, webflowMessage(body));
    }
    const created = createdItem.safeParse(parseJson(body));
    const url = created.success
      ? parseHttpUrl(
          new URL(`${collectionSlug}/${created.data.fieldData.slug}`, this.site.siteUrl).toString(),
        )
      : undefined;
    if (!url?.ok) return failure("unavailable", "Webflow did not return the new item", true);
    return ok({
      channel: this.channel,
      externalUrl: url.value,
      publishedAt: this.network.clock.now(),
    });
  }
}

/** Builds the publisher for a stored Webflow connection and its decrypted site token. */
export const webflowPublisherFactory =
  (network: WebflowNetwork & { readonly clock: Clock }) =>
  (connection: ChannelConnection, token: string): Publisher =>
    new WebflowPublisher(
      { siteUrl: connection.siteUrl, token, settings: connection.settings },
      network,
    );
