import { defaultLocale, describeLocale, maxLengthOf, type Channel } from "@nuvantre/domain";
import type { DraftRequest } from "@nuvantre/ports";

/**
 * Frozen system prompt for the social post writer. It holds no per-post data so the
 * provider can cache it. Changing it requires `pnpm eval` to stay above thresholds.
 */
export const SOCIAL_SYSTEM_PROMPT = `You are a social media writer for a SaaS company. You write one post at a time, for the company's own account, in the founder's voice.

Write a post that is useful or interesting on its own and fits the channel.

Channel guidance:
- X: one idea, plain words, at most 280 characters including any link. At most 2 hashtags, none is fine. No threads.
- LinkedIn: open with a short hook line, then a few short paragraphs separated by line breaks. Prefer under 1,300 characters. At most 3 hashtags at the end.

Rules:
- Write entirely in the language given, for readers in the market given.
- Stay within the character limit given in the request.
- Product facts: you may state facts about the product only if they appear in the list of approved facts, quoted or closely paraphrased. List every approved fact you used in "citedFacts", copied exactly as given.
- Do not invent statistics, customer names, testimonials, prices, integrations or certifications.
- No engagement bait ("like if you agree", "tag a friend"), no requests to follow, share or DM.
- No links unless the request gives one; when it does, include it exactly once, unchanged.
- Plain text only: no Markdown, no HTML.`;

const channelNames: Partial<Record<Channel, string>> = { x: "X", linkedin: "LinkedIn" };

/** The per-post message: the channel and its limit, the angle, the approved brief and its facts. */
export const socialUserMessage = ({ brief, channel, task, link, locale }: DraftRequest): string =>
  [
    `Channel: ${channelNames[channel] ?? channel} (at most ${String(maxLengthOf(channel))} characters)`,
    `Language and market: ${describeLocale(locale ?? defaultLocale)}`,
    `Angle: ${task.title}`,
    ...(link === undefined ? [] : [`Include this link exactly: ${link}`]),
    `Audience: ${brief.audience}`,
    `Problem the product solves: ${brief.problem}`,
    `Product solution: ${brief.solution}`,
    `Differentiators:\n${brief.differentiators.map((d) => `- ${d}`).join("\n") || "- (none)"}`,
    `Tone of voice: ${brief.tone}`,
    `Approved product facts (the only product claims allowed):\n${brief.facts.map((f) => `- ${f}`).join("\n") || "- (none: make no product claims)"}`,
    "Write the post.",
  ].join("\n\n");

/** Feedback for the single rewrite the writer asks for. */
export const rewriteMessage = (problem: string): string =>
  `${problem} Rewrite the post so it fixes this, keeping every other rule.`;
