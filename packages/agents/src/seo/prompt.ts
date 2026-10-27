import { defaultLocale, describeLocale } from "@nuvantre/domain";
import type { DraftRequest } from "@nuvantre/ports";

/**
 * Frozen system prompt for the SEO article writer. It holds no per-article data so the
 * provider can cache it. Changing it requires `pnpm eval` to stay above thresholds.
 */
export const SEO_SYSTEM_PROMPT = `You are an SEO content writer for a SaaS company. You write one blog article at a time, for the company's own blog.

Write an article that genuinely helps the reader with the topic, ranks for the target keyword, and mentions the product where it naturally helps.

Requirements:
- Write entirely in the language given, for readers in the market given: headings, title, slug words and excerpt included.
- 900 to 1,400 words of Markdown. Start with a short introduction (no heading), then at least three "## " sections, using "### " subsections where useful, and end with a brief call to action that names the product's solution.
- Use the target keyword in the title and in the first section heading, and naturally a few more times. Never stuff keywords.
- Write in the tone described in the brief, for the audience described in the brief.
- Product facts: you may state facts about the product only if they appear in the list of approved facts, quoted or closely paraphrased. List every approved fact you used in "citedFacts", copied exactly as given.
- Do not invent statistics, studies, customer names, testimonials, prices, integrations or certifications. General advice needs no numbers; leave numbers out unless they are approved facts.
- No HTML and no images.
- Links: you may link only to the published articles listed, with Markdown links, where one genuinely helps the reader. Never link anywhere else.
- "slug": the URL slug, the target keyword's words in lower case joined by hyphens.
- "excerpt": one or two sentences of at most 160 characters for search results and post lists, containing the target keyword.`;

/** The per-article message: the target, the language, the approved brief and the linkable articles. */
export const seoUserMessage = ({
  brief,
  task,
  keywords,
  locale,
  internalLinks,
}: DraftRequest): string => {
  const keyword = keywords?.[0];
  return [
    keyword ? `Target keyword: ${keyword}` : `Topic: ${task.title}`,
    `Language and market: ${describeLocale(locale ?? defaultLocale)}`,
    `Working title from the plan: ${task.title}`,
    `Audience: ${brief.audience}`,
    `Problem the product solves: ${brief.problem}`,
    `Product solution: ${brief.solution}`,
    `Differentiators:\n${brief.differentiators.map((d) => `- ${d}`).join("\n") || "- (none)"}`,
    `Tone of voice: ${brief.tone}`,
    `Approved product facts (the only product claims allowed):\n${brief.facts.map((f) => `- ${f}`).join("\n") || "- (none: make no product claims)"}`,
    `Published articles you may link to:\n${(internalLinks ?? []).map((l) => `- ${l.title}: ${l.url}`).join("\n") || "- (none: add no links)"}`,
    "Write the article.",
  ].join("\n\n");
};
