import type { Channel, PublishableContentItem, Result } from "@launchpilot/domain";
import type { PortError } from "./port-error";

export interface PublishReceipt {
  readonly channel: Channel;
  readonly externalUrl: string;
  readonly publishedAt: Date;
}

export type PublishError = PortError<"not_connected" | "rejected_by_platform" | "unavailable">;

/**
 * Publishes to one channel through its official API. Accepts only a PublishableContentItem,
 * which the domain hands out solely for founder-approved items on auto-publish channels.
 */
export interface Publisher {
  readonly channel: Channel;
  publish(item: PublishableContentItem): Promise<Result<PublishReceipt, PublishError>>;
}
