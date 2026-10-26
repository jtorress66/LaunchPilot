import { maxLengthOf, type BriefContent } from "@nuvantre/domain";
import type { ReviewIssue, ReviewRequest } from "@nuvantre/ports";

/** Launch-day hype no channel should carry. Lower case; matched as substrings. */
export const HYPE_WORDS = [
  "revolutionary",
  "game-changing",
  "game changer",
  "best-in-class",
  "world-class",
  "#1",
  "skyrocket",
  "explosive",
  "unprecedented",
];

const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const numbersIn = (text: string) => text.match(NUMBER) ?? [];
const valueOf = (shown: string) => Number(shown.replaceAll(",", ""));

const briefText = (brief: BriefContent) =>
  [
    brief.audience,
    brief.problem,
    brief.solution,
    brief.tone,
    ...brief.differentiators,
    ...brief.facts,
  ].join("\n");

/** Small counts ("3 reasons") and years read as wording, not as product claims. */
const isWording = (value: number) =>
  value <= 10 || (Number.isInteger(value) && value >= 2000 && value <= 2099);

/** Figures in the draft that neither the brief nor its required link contains. */
const unsupportedFigures = ({ brief, body, title, link }: ReviewRequest) => {
  const allowed = new Set([...numbersIn(briefText(brief)), ...numbersIn(link ?? "")].map(valueOf));
  const text = link === undefined ? `${title}\n${body}` : `${title}\n${body}`.replaceAll(link, "");
  const unknown = numbersIn(text).filter((n) => !allowed.has(valueOf(n)) && !isWording(valueOf(n)));
  return [...new Set(unknown)];
};

const blocker = (message: string): ReviewIssue => ({ severity: "blocker", message });

/**
 * The checks that need no model: channel length, the required link, hype, and figures the brief
 * does not state. Each finding is a blocker. Both reviewers start here.
 */
export const draftBlockers = (request: ReviewRequest): ReviewIssue[] => {
  const limit = maxLengthOf(request.channel);
  const lower = `${request.title}\n${request.body}`.toLowerCase();
  const hype = HYPE_WORDS.filter((word) => lower.includes(word));
  const figures = unsupportedFigures(request);
  return [
    ...(request.body.length > limit
      ? [
          blocker(
            `The text is ${String(request.body.length)} characters; ${request.channel} allows ${String(limit)}.`,
          ),
        ]
      : []),
    ...(request.link !== undefined && !request.body.includes(request.link)
      ? [blocker(`Include the link ${request.link}.`)]
      : []),
    ...(hype.length > 0 ? [blocker(`Remove hype: ${hype.map((w) => `"${w}"`).join(", ")}.`)] : []),
    ...(figures.length > 0
      ? [blocker(`These figures are not in the brief: ${figures.join(", ")}.`)]
      : []),
  ];
};

/** A draft with no text cannot be reviewed; that is the caller's error, not a verdict. */
export const isEmptyDraft = ({ body }: ReviewRequest): boolean => body.trim() === "";
