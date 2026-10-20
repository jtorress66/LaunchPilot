import { weeklyChannelCaps } from "@launchpilot/domain";
import type { PlanRequest } from "@launchpilot/ports";
import { reportLines } from "../analytics/prompt";

/** Frozen: change it only with an eval run (`pnpm eval`). No per-product data, so it caches. */
export const STRATEGIST_SYSTEM_PROMPT = `You are the strategist for a SaaS founder's weekly marketing. Each week you plan which content to draft: SEO articles for the founder's blog and posts for X and LinkedIn. Writers draft each task, a reviewer checks it, and the founder approves everything before it is published.

Plan:
- name: a short name for the week.
- goal: one sentence on what this week's content should achieve.
- tasks: each with kind, channel, title, rationale, keyword and angle.
  - seo_article on "blog": keyword is one of the offered keywords, copied exactly; angle is null.
  - social_post on "x" or "linkedin": angle is one of the angles offered for that channel, copied exactly; keyword is null.
  - rationale: one sentence on why this task, this week.

Rules:
- Use only the offered keywords and angles. Never invent a topic.
- Stay within the allowance and each channel's weekly cap. Articles matter most: plan them first.
- Only state numbers that appear in last week's report or in the offered keyword figures. Do not forecast.
- Prefer keywords that match last week's top searches, and angles that support the articles.
- No hype, no Markdown.`;

export const strategistUserMessage = ({
  product,
  brief,
  week,
  lastWeek,
  allowance,
  candidates,
}: PlanRequest): string =>
  [
    `Product: ${product.name}`,
    `Week starting: ${week.start.toISOString().slice(0, 10)}`,
    `Audience: ${brief.audience}`,
    `Problem: ${brief.problem}`,
    `Allowance: at most ${String(allowance)} tasks this week`,
    `Weekly caps per channel: ${Object.entries(weeklyChannelCaps)
      .map(([channel, cap]) => `${channel} ${String(cap)}`)
      .join(", ")}`,
    `Offered keywords:\n${
      candidates.keywords
        .map(
          (k) =>
            `- "${k.keyword}": ${String(k.monthlySearches)} searches a month, difficulty ${String(k.difficulty)}`,
        )
        .join("\n") || "- (none: plan no articles)"
    }`,
    `Offered post angles:\n${candidates.angles.map((a) => `- ${a.channel}: "${a.angle}"`).join("\n") || "- (none: plan no posts)"}`,
    ...(lastWeek === null
      ? ["Last week: no report yet"]
      : ["Last week's report:", ...reportLines(lastWeek)]),
    "Plan the week.",
  ].join("\n\n");

export const rewriteMessage = (problems: readonly string[]): string =>
  [
    "The plan breaks these rules:",
    ...problems.map((problem) => `- ${problem}`),
    "Rewrite the whole plan so it fixes them, keeping every other rule.",
  ].join("\n");
