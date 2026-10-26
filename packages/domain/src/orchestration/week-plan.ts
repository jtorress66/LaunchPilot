import type { Channel } from "../channels/channel";
import type { KeywordMetrics } from "../seo/keyword-opportunity";
import type { PostAngle } from "../social/post-angles";
import type { SocialChannel } from "../social/social-profile";
import type { TaskKind } from "../task/task";

/** What the strategist proposes for one task, before Nuvantre checks it. */
export interface ProposedTask {
  readonly kind: TaskKind;
  readonly channel: Channel;
  readonly title: string;
  readonly rationale: string;
  /** For an article: one of the offered keyword opportunities. */
  readonly keyword?: string | undefined;
  /** For a post: one of the offered angles, for the same channel. */
  readonly angle?: string | undefined;
}

export type AcceptedTask =
  | {
      readonly kind: "seo_article";
      readonly channel: "blog";
      readonly title: string;
      readonly rationale: string;
      readonly seo: KeywordMetrics;
    }
  | {
      readonly kind: "social_post";
      readonly channel: SocialChannel;
      readonly title: string;
      readonly rationale: string;
      readonly angle: PostAngle;
    };

export type DropReason =
  | "not_plannable"
  | "unknown_keyword"
  | "unknown_angle"
  | "duplicate"
  | "channel_full"
  | "over_allowance";

export interface WeekCandidates {
  readonly keywords: readonly KeywordMetrics[];
  readonly angles: readonly PostAngle[];
}

export interface ValidatedWeekPlan {
  readonly accepted: readonly AcceptedTask[];
  readonly dropped: readonly { readonly task: ProposedTask; readonly reason: DropReason }[];
}

/** The most the weekly loop drafts per channel. Data, so a new channel is one more row. */
export const weeklyChannelCaps: Readonly<Partial<Record<Channel, number>>> = {
  blog: 2,
  x: 3,
  linkedin: 2,
};

/** Which channels each kind of task may target. Launch and community work stay with the founder. */
const plannable: Readonly<Partial<Record<TaskKind, readonly Channel[]>>> = {
  seo_article: ["blog"],
  social_post: ["x", "linkedin"],
};

const normalise = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

type Check =
  { readonly task: AcceptedTask; readonly key: string } | { readonly reason: DropReason };

const ground = (task: ProposedTask, candidates: WeekCandidates): Check => {
  if (!(plannable[task.kind] ?? []).includes(task.channel)) return { reason: "not_plannable" };
  const base = { title: task.title, rationale: task.rationale };
  if (task.kind === "seo_article") {
    const seo = candidates.keywords.find(
      (k) => task.keyword !== undefined && normalise(k.keyword) === normalise(task.keyword),
    );
    if (!seo) return { reason: "unknown_keyword" };
    return {
      task: { ...base, kind: "seo_article", channel: "blog", seo },
      key: `kw:${normalise(seo.keyword)}`,
    };
  }
  const angle = candidates.angles.find(
    (a) =>
      a.channel === task.channel &&
      task.angle !== undefined &&
      normalise(a.angle) === normalise(task.angle),
  );
  if (!angle) return { reason: "unknown_angle" };
  return {
    task: { ...base, kind: "social_post", channel: angle.channel, angle },
    key: `angle:${angle.channel}:${normalise(angle.angle)}`,
  };
};

/**
 * Keeps only the tasks Nuvantre can stand behind: plannable kinds and channels, grounded in
 * the offered keywords and angles, no repeats, within each channel's weekly cap and the plan's
 * remaining monthly allowance (articles first). Every dropped task says why.
 */
export const validateWeekPlan = (
  tasks: readonly ProposedTask[],
  { allowance, candidates }: { readonly allowance: number; readonly candidates: WeekCandidates },
): ValidatedWeekPlan => {
  const dropped: { task: ProposedTask; reason: DropReason }[] = [];
  const valid: { proposed: ProposedTask; task: AcceptedTask }[] = [];
  const seen = new Set<string>();
  const perChannel = new Map<Channel, number>();
  for (const proposed of tasks) {
    const checked = ground(proposed, candidates);
    if ("reason" in checked) {
      dropped.push({ task: proposed, reason: checked.reason });
      continue;
    }
    if (seen.has(checked.key)) {
      dropped.push({ task: proposed, reason: "duplicate" });
      continue;
    }
    const used = perChannel.get(checked.task.channel) ?? 0;
    if (used >= (weeklyChannelCaps[checked.task.channel] ?? 0)) {
      dropped.push({ task: proposed, reason: "channel_full" });
      continue;
    }
    seen.add(checked.key);
    perChannel.set(checked.task.channel, used + 1);
    valid.push({ proposed, task: checked.task });
  }
  const ordered = [
    ...valid.filter((v) => v.task.kind === "seo_article"),
    ...valid.filter((v) => v.task.kind === "social_post"),
  ];
  const room = Math.max(0, allowance);
  for (const extra of ordered.slice(room))
    dropped.push({ task: extra.proposed, reason: "over_allowance" });
  return { accepted: ordered.slice(0, room).map((v) => v.task), dropped };
};
