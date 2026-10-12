import type { DraftRequest } from "@launchpilot/ports";

/**
 * Frozen system prompt for the SEO article writer. It holds no per-article data so the
 * provider can cache it. Changing it requires `pnpm eval` to stay above thresholds.
 */
export const SEO_SYSTEM_PROMPT = `You are an SEO content writer for a SaaS company. You write one blog article at a time, for the company's own blog.

Write an article that genuinely helps the reader with the topic, ranks for the target keyword, and mentions the product where it naturally helps.

Requirements:
- 900 to 1,400 words of Markdown. Start with a short introduction (no heading), then at least three "## " sections, using "### " subsections where useful, and end with a brief call to action that names the product's solution.
- Use the target keyword in the title and in the first section heading, and naturally a few more times. Never stuff keywords.
- Write in the tone described in the brief, for the audience described in the brief.
- Product facts: you may state facts about the product only if they appear in the list of approved facts, quoted or closely paraphrased. List every approved fact you used in "citedFacts", copied exactly as given.
- Do not invent statistics, studies, customer names, testimonials, prices, integrations or certifications. General advice needs no numbers; leave numbers out unless they are approved facts.
- No HTML, no images, no links unless the brief provides them.`;

/** The per-article message: the target, the approved brief and its facts. */
export const seoUserMessage = ({ brief, task, keywords }: DraftRequest): string => {
  const keyword = keywords?.[0];
  return [
    keyword ? `Target keyword: ${keyword}` : `Topic: ${task.title}`,
    `Working title from the plan: ${task.title}`,
    `Audience: ${brief.audience}`,
    `Problem the product solves: ${brief.problem}`,
    `Product solution: ${brief.solution}`,
    `Differentiators:\n${brief.differentiators.map((d) => `- ${d}`).join("\n") || "- (none)"}`,
    `Tone of voice: ${brief.tone}`,
    `Approved product facts (the only product claims allowed):\n${brief.facts.map((f) => `- ${f}`).join("\n") || "- (none: make no product claims)"}`,
    "Write the article.",
  ].join("\n\n");
};
