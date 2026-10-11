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
  /** True only when LaunchPilot may publish through an official API after founder approval. */
  readonly autoPublish: boolean;
}

/** One entry per channel: adding a channel means adding a row here, not a branch elsewhere. */
const channelPolicies: Readonly<Record<Channel, ChannelPolicy>> = {
  blog: { autoPublish: true },
  x: { autoPublish: true },
  linkedin: { autoPublish: true },
  // Launch platforms and directories get a prepared kit the founder submits.
  producthunt: { autoPublish: false },
  directory: { autoPublish: false },
  // Community sites are draft-only by product rule: never auto-post.
  reddit: { autoPublish: false },
  hackernews: { autoPublish: false },
  indiehackers: { autoPublish: false },
};

export const isAutoPublishable = (channel: Channel): boolean =>
  channelPolicies[channel].autoPublish;
