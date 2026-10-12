import { err, ok, type Result } from "@launchpilot/domain";
import type {
  BriefDraft,
  BriefDraftError,
  BriefDrafter,
  BriefDraftRequest,
  CrawledPage,
} from "@launchpilot/ports";

const MAX_FACTS = 8;
const MAX_DIFFERENTIATORS = 3;
const MAX_SENTENCE = 500;

const PAIN =
  /\b(waste|wastes|struggle|struggles|tired|hard|pain|painful|frustrat\w*|problem|stuck|manual|slow)\b/i;
const CONCRETE = /\d|[$€£]|\b(free|trial|pricing|price|compliant|gdpr|soc|integrat\w*|api)\b/i;
const DISTINCT = /\b(no|never|only|without|minutes|one|simple|instant)\b/i;
const AUDIENCE = /\bfor ([^.!?,;:]+)/i;

/** Complete sentences of at least three words, in page order. */
const sentencesOf = (page: CrawledPage): string[] =>
  page.text
    .split("\n")
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter((s) => /[.!?]$/.test(s) && s.split(/\s+/).length >= 3 && s.length <= MAX_SENTENCE);

/**
 * Deterministic drafter that copies sentences from the site and uses no LLM.
 * It backs local development and E2E tests; every fact is a verbatim quote.
 */
export class ExtractiveBriefDrafter implements BriefDrafter {
  draft({ productName, site }: BriefDraftRequest): Promise<Result<BriefDraft, BriefDraftError>> {
    const [home, ...rest] = site.pages;
    const homeSentences = home ? sentencesOf(home) : [];
    const all = [...homeSentences, ...rest.flatMap(sentencesOf)];
    if (all.length === 0) {
      return Promise.resolve(
        err({
          code: "generation_failed",
          message: "The site has no readable text to draft a brief from",
          retryable: false,
        }),
      );
    }

    const problem = all.find((s) => PAIN.test(s));
    const solution = homeSentences.find((s) => s !== problem) ?? all.find((s) => s !== problem);
    const used = new Set([problem, solution]);
    const concrete = all.filter((s) => !used.has(s) && CONCRETE.test(s));
    const facts = (concrete.length > 0 ? concrete : all).slice(0, MAX_FACTS);
    const differentiators = all
      .filter((s) => !used.has(s) && !facts.includes(s) && DISTINCT.test(s))
      .slice(0, MAX_DIFFERENTIATORS);
    const audience = [...homeSentences, home?.title ?? ""]
      .map((s) => AUDIENCE.exec(s)?.[1]?.trim())
      .find((match) => match !== undefined && match !== "");

    return Promise.resolve(
      ok({
        content: {
          audience: audience ?? `People interested in ${productName}`,
          problem: problem ?? "Not stated on the site yet. Describe the problem your audience has.",
          solution: solution ?? facts[0] ?? productName,
          differentiators,
          tone: "Clear and direct",
          facts,
        },
        evidence: facts.map((fact) => ({ statement: fact, quote: fact })),
        droppedClaims: [],
      }),
    );
  }
}
