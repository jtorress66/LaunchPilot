import { err, ok, type Result } from "@launchpilot/domain";
import type { ContentDrafter, Draft, DraftError, DraftRequest } from "@launchpilot/ports";

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Deterministic, offline article writer for local development and E2E tests.
 * It assembles the brief into a structured article and states only brief facts, verbatim.
 */
export class TemplateArticleWriter implements ContentDrafter {
  draft({ brief, task, keywords }: DraftRequest): Promise<Result<Draft, DraftError>> {
    const topic = (keywords?.[0] ?? task.title).trim();
    if (topic === "") {
      return Promise.resolve(
        err({ code: "generation_failed", message: "The article has no topic", retryable: false }),
      );
    }
    const sections = [
      `If you are one of the ${brief.audience.toLowerCase()} we work with, ${topic} is probably on your list. ${brief.problem}.`,
      `## Why ${topic} matters`,
      `${brief.problem}. Getting ${topic} right early saves time later and keeps your focus on the product.`,
      `## How to approach ${topic}`,
      [
        `1. Decide what you want ${topic} to achieve this quarter.`,
        "2. Start with the smallest setup that answers that question.",
        "3. Review the results every week and adjust.",
      ].join("\n"),
      "## How we help",
      brief.solution,
      ...brief.differentiators.map((d) => `- ${d}`),
      ...(brief.facts.length > 0
        ? ["## Key facts", brief.facts.map((fact) => `- ${fact}`).join("\n")]
        : []),
      "## Next steps",
      `Ready to make ${topic} simpler? ${brief.solution}`,
    ];
    return Promise.resolve(
      ok({
        title: `${capitalise(topic)}: a practical guide for ${brief.audience}`,
        body: sections.join("\n\n"),
        citedFacts: [...brief.facts],
      }),
    );
  }
}
