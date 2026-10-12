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
import { ayrshareMessage, callAyrshare, isOutage, platformOf, type AyrshareOptions } from "./api";

const created = z.object({
  postIds: z.array(z.object({ platform: z.string(), postUrl: z.string().optional() })).default([]),
});

/** Where a receipt points when Ayrshare confirms a post but returns no URL for it. */
const homePages: Readonly<Record<SocialChannel, string>> = {
  x: "https://x.com/",
  linkedin: "https://www.linkedin.com/feed/",
};

const names: Readonly<Record<SocialChannel, string>> = { x: "X", linkedin: "LinkedIn" };

const failure = (code: PublishError["code"], message: string, retryable: boolean) =>
  err<PublishError>({ code, message, retryable });

/** Ayrshare reports an unlinked account inside a 400; its message is the only signal. */
const NOT_LINKED = /not linked|link the account|no linked/i;

/** Publishes approved posts to X or LinkedIn through Ayrshare's official API. */
export class AyrsharePublisher implements Publisher {
  constructor(
    readonly channel: SocialChannel,
    private readonly profileKey: string,
    private readonly options: AyrshareOptions,
  ) {}

  async publish(item: PublishableContentItem): Promise<Result<PublishReceipt, PublishError>> {
    const platform = platformOf[this.channel];
    const response = await callAyrshare(this.options, {
      method: "POST",
      path: "post",
      profileKey: this.profileKey,
      forX: this.channel === "x",
      body: { post: item.body, platforms: [platform] },
    });
    if (!response.ok) return failure("unavailable", "Ayrshare could not be reached", true);
    const { status, body } = response.value;
    const name = names[this.channel];
    if (isOutage(status)) {
      return failure("unavailable", `Ayrshare is unavailable (HTTP ${String(status)})`, true);
    }
    if (status === 401 || status === 403) {
      return failure("not_connected", "Ayrshare did not accept LaunchPilot's API key", false);
    }
    if (status === 419) {
      return failure("not_connected", "Posting to X needs your X developer app keys", false);
    }
    if (status >= 400) {
      const reason = ayrshareMessage(body) ?? `HTTP ${String(status)}`;
      return NOT_LINKED.test(reason)
        ? failure("not_connected", `${name} is not linked: ${reason}`, false)
        : failure("rejected_by_platform", `${name} rejected the post: ${reason}`, false);
    }
    const parsed = created.safeParse(body);
    if (!parsed.success) {
      return failure("unavailable", "Ayrshare answered in an unexpected format", true);
    }
    const postUrl = parsed.data.postIds.find((p) => p.platform === platform)?.postUrl;
    const url = parseHttpUrl(postUrl ?? homePages[this.channel]);
    return ok({
      channel: this.channel,
      externalUrl: url.ok ? url.value : homePages[this.channel],
      publishedAt: this.options.clock.now(),
    });
  }
}
