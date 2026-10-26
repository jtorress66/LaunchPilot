export const channels = [
  "blog",
  "x",
  "linkedin",
  "producthunt",
  "directory",
  "reddit",
  "hackernews",
  "indiehackers",
] as const;

export type Channel = (typeof channels)[number];

interface ChannelPolicy {
  /** True only when Nuvantre may publish through an official API after founder approval. */
  readonly autoPublish: boolean;
  /** Longest body the channel accepts, in characters. */
  readonly maxLength: number;
}

const LONG_FORM = 100_000;

/** One entry per channel: adding a channel means adding a row here, not a branch elsewhere. */
const channelPolicies: Readonly<Record<Channel, ChannelPolicy>> = {
  blog: { autoPublish: true, maxLength: LONG_FORM },
  x: { autoPublish: true, maxLength: 280 },
  linkedin: { autoPublish: true, maxLength: 3000 },
  // Launch platforms and directories get a prepared kit the founder submits.
  producthunt: { autoPublish: false, maxLength: LONG_FORM },
  directory: { autoPublish: false, maxLength: LONG_FORM },
  // Community sites are draft-only by product rule: never auto-post.
  reddit: { autoPublish: false, maxLength: LONG_FORM },
  hackernews: { autoPublish: false, maxLength: LONG_FORM },
  indiehackers: { autoPublish: false, maxLength: LONG_FORM },
};

export const isAutoPublishable = (channel: Channel): boolean =>
  channelPolicies[channel].autoPublish;

export const maxLengthOf = (channel: Channel): number => channelPolicies[channel].maxLength;
