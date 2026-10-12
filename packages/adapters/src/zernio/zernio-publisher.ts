import {
  err,
  ok,
  parseHttpUrl,
  type PublishableContentItem,
  type Result,
  type SocialChannel,
} from "@launchpilot/domain";
import type { PublishError, PublishReceipt, Publisher } from "@launchpilot/ports";
import { z } from "zod";
import {
  callZernio,
  channelNames,
  isOutage,
  platformOf,
  zernioCode,
  zernioMessage,
  type ZernioOptions,
} from "./api";

const published = z.object({
  post: z.object({
    platforms: z
      .array(z.object({ platform: z.string(), platformPostUrl: z.string().nullish() }))
      .default([]),
  }),
});

const incomplete = z.object({
  platformResults: z.array(z.object({ error: z.string().nullable() })).optional(),
  error: z.string().optional(),
});

/** Where a receipt points when Zernio confirms a post but returns no URL for it. */
const homePages: Readonly<Record<SocialChannel, string>> = {
  x: "https://x.com/",
  linkedin: "https://www.linkedin.com/feed/",
};

const failure = (code: PublishError["code"], message: string, retryable: boolean) =>
  err<PublishError>({ code, message, retryable });

/** The platform's reason a 207 publish failed. */
const incompleteReason = (body: unknown) => {
  const parsed = incomplete.safeParse(body);
  if (!parsed.success) return undefined;
  return parsed.data.platformResults?.find((r) => r.error)?.error ?? parsed.data.error;
};

/** Publishes approved posts to X or LinkedIn through Zernio's official API. */
export class ZernioPublisher implements Publisher {
  constructor(
    readonly channel: SocialChannel,
    private readonly accountId: string,
    private readonly options: ZernioOptions,
  ) {}

  async publish(item: PublishableContentItem): Promise<Result<PublishReceipt, PublishError>> {
    const response = await callZernio(this.options, {
      method: "POST",
      path: "posts",
      // Same revision, same key: a retry after a timeout returns the original post, never a second one.
      idempotencyKey: `${item.id}:v${String(item.version)}`,
      body: {
        content: item.body,
        platforms: [{ platform: platformOf[this.channel], accountId: this.accountId }],
        publishNow: true,
      },
    });
    if (!response.ok) return failure("unavailable", "Zernio could not be reached", true);
    const { status, body } = response.value;
    const name = channelNames[this.channel];
    const reason = zernioMessage(body) ?? `HTTP ${String(status)}`;

    if (isOutage(status)) {
      return failure("unavailable", `Zernio is unavailable (HTTP ${String(status)})`, true);
    }
    if (status === 401) {
      return failure("not_connected", "Zernio did not accept LaunchPilot's API key", false);
    }
    if (status === 402) {
      return failure("not_connected", `Zernio needs a payment method first: ${reason}`, false);
    }
    if (status === 403) {
      return failure("not_connected", `${name} needs to be linked again: ${reason}`, false);
    }
    if (status === 409 && zernioCode(body) === "idempotency_conflict") {
      return failure("unavailable", "Zernio is still publishing this post", true);
    }
    if (status === 207) {
      const why = incompleteReason(body) ?? "publishing failed";
      return failure("rejected_by_platform", `${name} rejected the post: ${why}`, false);
    }
    if (status >= 400) {
      return failure("rejected_by_platform", `${name} rejected the post: ${reason}`, false);
    }
    const parsed = published.safeParse(body);
    if (!parsed.success) {
      return failure("unavailable", "Zernio answered in an unexpected format", true);
    }
    const target = parsed.data.post.platforms.find((p) => p.platform === platformOf[this.channel]);
    const url = parseHttpUrl(target?.platformPostUrl ?? homePages[this.channel]);
    return ok({
      channel: this.channel,
      externalUrl: url.ok ? url.value : homePages[this.channel],
      publishedAt: this.options.clock.now(),
    });
  }
}
