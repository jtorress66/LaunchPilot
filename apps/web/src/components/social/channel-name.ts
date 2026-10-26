import type { Channel } from "@nuvantre/domain";

const names: Record<Channel, string> = {
  blog: "Blog",
  x: "X",
  linkedin: "LinkedIn",
  producthunt: "Product Hunt",
  directory: "Directory",
  reddit: "Reddit",
  hackernews: "Hacker News",
  indiehackers: "Indie Hackers",
};

export const channelName = (channel: Channel): string => names[channel];
