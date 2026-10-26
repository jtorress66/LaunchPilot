import { err, listingLimits, ok, type Result } from "@nuvantre/domain";
import type {
  DraftError,
  LaunchKitDraft,
  LaunchKitDrafter,
  LaunchKitRequest,
} from "@nuvantre/ports";
import { SHOW_HN_TITLE_MAX } from "./prompt";

const ELLIPSIS = "…";

/** Shortens `text` to `max` characters at a word boundary. */
const fit = (text: string, max: number): string => {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - ELLIPSIS.length);
  const atWord = cut.slice(0, cut.lastIndexOf(" ")).trimEnd();
  return `${atWord || cut}${ELLIPSIS}`;
};

const MAX_FEATURES = 6;

/**
 * Deterministic, offline launch kit writer for local development and E2E tests.
 * It reuses the brief's own words and states only brief facts, verbatim.
 */
export class TemplateLaunchKitWriter implements LaunchKitDrafter {
  draft({ brief, product }: LaunchKitRequest): Promise<Result<LaunchKitDraft, DraftError>> {
    const name = product.name.trim();
    if (name === "") {
      return Promise.resolve(
        err({ code: "generation_failed", message: "The product has no name", retryable: false }),
      );
    }
    const features = [...brief.differentiators, ...brief.facts]
      .map((item) => fit(item, listingLimits.feature))
      .slice(0, MAX_FEATURES);
    const fallback = [`Built for ${brief.audience}`, brief.solution, `Made by the ${name} team`];
    for (const extra of fallback) {
      if (features.length >= 3) break;
      features.push(fit(extra, listingLimits.feature));
    }
    const listing = {
      name: fit(name, listingLimits.name),
      tagline: fit(brief.solution, listingLimits.tagline),
      shortDescription: fit(
        `${brief.solution}. Built for ${brief.audience}.`,
        listingLimits.shortDescription,
      ),
      longDescription: fit(
        [brief.problem, `${name}: ${brief.solution}.`, ...brief.differentiators].join(" "),
        listingLimits.longDescription,
      ),
      features,
      categories: ["SaaS"],
      makerComment: fit(
        `Hi everyone! We built ${name} because ${brief.problem.toLowerCase()}. ${brief.solution}. We would love your feedback.`,
        listingLimits.makerComment,
      ),
    };
    const story = `${brief.problem}. We built ${name} for ${brief.audience}: ${brief.solution}. ${product.url}`;
    return Promise.resolve(
      ok({
        listing,
        community: [
          {
            channel: "hackernews",
            title: fit(`Show HN: ${name} – ${brief.solution}`, SHOW_HN_TITLE_MAX),
            body: `${story}\n\nFeedback welcome.`,
          },
          { channel: "reddit", title: fit(`I built ${name}: ${brief.solution}`, 300), body: story },
          { channel: "indiehackers", title: fit(`Launching ${name}`, 300), body: story },
        ],
        citedFacts: brief.facts.filter((fact) => features.includes(fact)),
      }),
    );
  }
}
