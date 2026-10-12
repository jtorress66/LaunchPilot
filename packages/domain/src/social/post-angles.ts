import type { BriefContent } from "../brief/brief";
import { socialChannels, type SocialChannel } from "./social-profile";

/** What one social post is about. Every angle comes from the brief or the founder's own article. */
export interface PostAngle {
  readonly channel: SocialChannel;
  readonly angle: string;
  /** A link the post must include, e.g. the article it promotes. */
  readonly link: string | null;
}

export interface PostAnglePlan {
  readonly x: number;
  readonly linkedin: number;
  readonly latestArticle?: { readonly title: string; readonly url: string };
}

const anglePool = (brief: BriefContent, plan: PostAnglePlan) => [
  ...(plan.latestArticle
    ? [{ angle: `New article: ${plan.latestArticle.title}`, link: plan.latestArticle.url }]
    : []),
  ...brief.differentiators.map((d) => ({ angle: `Why it matters: ${d}`, link: null })),
  ...brief.facts.map((fact) => ({ angle: `Worth knowing: ${fact}`, link: null })),
  { angle: `The problem: ${brief.problem}`, link: null },
  { angle: `How we solve it: ${brief.solution}`, link: null },
];

/** Deterministic: each channel walks the same pool from the top, cycling when it runs out. */
export const planPostAngles = (brief: BriefContent, plan: PostAnglePlan): PostAngle[] => {
  const pool = anglePool(brief, plan);
  return socialChannels.flatMap((channel) =>
    Array.from({ length: plan[channel] }, (_, i) => {
      const { angle, link } = pool[i % pool.length] ?? { angle: brief.problem, link: null };
      return { channel, angle, link };
    }),
  );
};
