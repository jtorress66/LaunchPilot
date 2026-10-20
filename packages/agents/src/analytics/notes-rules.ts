import { numbersNotInReport, type AnalystNotes, type WeeklyReport } from "@launchpilot/domain";
import { MAX_HIGHLIGHTS, MAX_SUGGESTIONS } from "./prompt";

const SUMMARY_MAX = 600;
const LINE_MAX = 240;

const tooLong = (label: string, lines: readonly string[]) =>
  lines.some((line) => line.length > LINE_MAX)
    ? [`Keep each ${label} under ${String(LINE_MAX)} characters.`]
    : [];

/** Every way the notes break the rules, one line each; empty when they are fine. */
export const notesProblems = (report: WeeklyReport, notes: AnalystNotes): string[] => {
  const unknown = numbersNotInReport(
    report,
    [notes.summary, ...notes.highlights, ...notes.suggestions].join("\n"),
  );
  return [
    ...(notes.summary.trim() === "" ? ["Write a summary."] : []),
    ...(notes.summary.length > SUMMARY_MAX
      ? [`Keep the summary under ${String(SUMMARY_MAX)} characters.`]
      : []),
    ...(notes.highlights.length > MAX_HIGHLIGHTS
      ? [`Give at most ${String(MAX_HIGHLIGHTS)} highlights.`]
      : []),
    ...(notes.suggestions.length < 1 || notes.suggestions.length > MAX_SUGGESTIONS
      ? [`Give 1 to ${String(MAX_SUGGESTIONS)} suggestions.`]
      : []),
    ...tooLong("highlight", notes.highlights),
    ...tooLong("suggestion", notes.suggestions),
    ...(unknown.length > 0 ? [`These numbers are not in the report: ${unknown.join(", ")}.`] : []),
  ];
};
