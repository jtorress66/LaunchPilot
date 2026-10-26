import { err, maxLengthOf, ok, type Result } from "@nuvantre/domain";
import type { ContentDrafter, Draft, DraftError, DraftRequest } from "@nuvantre/ports";

const ELLIPSIS = "…";

/** Shortens `text` to `max` characters at a word boundary. */
const shorten = (text: string, max: number): string => {
  if (text.length <= max) return text;
  const cut = text.slice(0, Math.max(0, max - ELLIPSIS.length));
  const atWord = cut.slice(0, cut.lastIndexOf(" ")).trimEnd();
  return `${atWord || cut}${ELLIPSIS}`;
};

/**
 * Deterministic, offline social post writer for local development and E2E tests.
 * It states the angle and the brief's solution, and cites only brief facts it repeats verbatim.
 */
export class TemplatePostWriter implements ContentDrafter {
  draft({ brief, channel, task, link }: DraftRequest): Promise<Result<Draft, DraftError>> {
    const angle = task.title.trim();
    if (angle === "") {
      return Promise.resolve(
        err({ code: "generation_failed", message: "The post has no angle", retryable: false }),
      );
    }
    const suffix = link === undefined ? "" : `\n\n${link}`;
    const text = shorten(`${angle}\n\n${brief.solution}.`, maxLengthOf(channel) - suffix.length);
    const body = `${text}${suffix}`;
    return Promise.resolve(
      ok({
        title: angle.slice(0, 200),
        body,
        citedFacts: brief.facts.filter((fact) => body.includes(fact)),
      }),
    );
  }
}
