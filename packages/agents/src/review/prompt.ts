import { defaultLocale, describeLocale, type BriefContent } from "@nuvantre/domain";
import type { ReviewRequest } from "@nuvantre/ports";

/** Frozen: change it only with an eval run (`pnpm eval`). No per-product data, so it caches. */
export const REVIEWER_SYSTEM_PROMPT = `You review drafts of marketing content for a SaaS founder before the founder reads them. You recommend; the founder decides.

Check the draft against the approved product statements and the channel:
- blocker: a product claim that no approved statement supports (a feature, integration, customer, number, certification or price they do not state), anything misleading, text that breaks the channel's format, or a draft not written in the language given. Restating or paraphrasing an approved statement is fine.
- suggestion: clarity, structure, tone that does not match the brief, a weak opening or ending.

Answer with:
- decision: "pass" when there are no blockers, otherwise "needs_changes".
- issues: each with a severity and one short, specific sentence the writer can act on. Leave it empty when the draft is fine.

Do not rewrite the draft. Do not invent problems: an empty issue list is a good answer for a good draft.`;

/** What the brief says the product is and does: the same text the rule checks accept figures from. */
const approvedStatements = (brief: BriefContent): string =>
  [brief.solution, ...brief.differentiators, ...brief.facts]
    .filter((statement) => statement.trim() !== "")
    .map((statement) => `- ${statement}`)
    .join("\n") || "- (none: the draft may make no product claims)";

export const reviewerUserMessage = ({
  brief,
  channel,
  title,
  body,
  link,
  locale,
}: ReviewRequest): string =>
  [
    `Channel: ${channel}`,
    `Language and market: ${describeLocale(locale ?? defaultLocale)}`,
    `Audience: ${brief.audience}`,
    `Tone of voice: ${brief.tone}`,
    `Approved product statements (the only product claims allowed):\n${approvedStatements(brief)}`,
    ...(link === undefined ? [] : [`The draft must include this link: ${link}`]),
    `Title: ${title}`,
    `Draft:\n${body}`,
    "Review the draft.",
  ].join("\n\n");
