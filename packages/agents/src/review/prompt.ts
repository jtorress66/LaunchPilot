import type { ReviewRequest } from "@launchpilot/ports";

/** Frozen: change it only with an eval run (`pnpm eval`). No per-product data, so it caches. */
export const REVIEWER_SYSTEM_PROMPT = `You review drafts of marketing content for a SaaS founder before the founder reads them. You recommend; the founder decides.

Check the draft against the approved product facts and the channel:
- blocker: a product claim that is not in the approved facts (a feature, integration, customer, number, certification or price the facts do not state), anything misleading, or text that breaks the channel's format.
- suggestion: clarity, structure, tone that does not match the brief, a weak opening or ending.

Answer with:
- decision: "pass" when there are no blockers, otherwise "needs_changes".
- issues: each with a severity and one short, specific sentence the writer can act on. Leave it empty when the draft is fine.

Do not rewrite the draft. Do not invent problems: an empty issue list is a good answer for a good draft.`;

export const reviewerUserMessage = ({ brief, channel, title, body, link }: ReviewRequest): string =>
  [
    `Channel: ${channel}`,
    `Audience: ${brief.audience}`,
    `Tone of voice: ${brief.tone}`,
    `Approved product facts (the only product claims allowed):\n${brief.facts.map((f) => `- ${f}`).join("\n") || "- (none: the draft may make no product claims)"}`,
    ...(link === undefined ? [] : [`The draft must include this link: ${link}`]),
    `Title: ${title}`,
    `Draft:\n${body}`,
    "Review the draft.",
  ].join("\n\n");
