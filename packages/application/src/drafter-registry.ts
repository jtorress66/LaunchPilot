import type { Channel } from "@nuvantre/domain";
import type { ContentDrafter } from "@nuvantre/ports";

/**
 * Which writer drafts for which channel. A new channel is a new registration in the
 * composition root, never a new branch in the loop.
 */
export class DrafterRegistry {
  private readonly byChannel: ReadonlyMap<Channel, ContentDrafter>;

  constructor(entries: readonly { readonly channel: Channel; readonly drafter: ContentDrafter }[]) {
    const channels = entries.map((e) => e.channel);
    if (new Set(channels).size !== channels.length) {
      throw new Error(`Each channel needs exactly one drafter: ${channels.join(", ")}`);
    }
    this.byChannel = new Map(entries.map((e) => [e.channel, e.drafter]));
  }

  for(channel: Channel): ContentDrafter | undefined {
    return this.byChannel.get(channel);
  }
}
