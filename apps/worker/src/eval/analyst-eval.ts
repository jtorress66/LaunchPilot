import {
  buildWeeklyReport,
  err,
  metricNames,
  numbersNotInReport,
  ok,
  productId,
  weeklyReportId,
  type Result,
  type WeeklyReport,
} from "@nuvantre/domain";
import type { Analysis, AnalysisError } from "@nuvantre/ports";
import { z } from "zod";
import { evalThresholds, meets } from "./thresholds";

const date = z.coerce.date();
const snapshot = z.object({
  source: z.string(),
  from: date,
  to: date,
  values: z.partialRecord(z.enum(metricNames), z.number().nonnegative()),
  topPages: z.array(z.object({ url: z.string(), visitors: z.number().nonnegative() })),
  topQueries: z.array(
    z.object({
      query: z.string(),
      clicks: z.number().nonnegative(),
      impressions: z.number().nonnegative(),
      position: z.number().nonnegative(),
    }),
  ),
});

const outcome = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ok"), current: snapshot, previous: snapshot.nullable() }),
  z.object({ kind: z.literal("not_connected") }),
  z.object({ kind: z.literal("failed"), reason: z.string() }),
]);

/** What each analytics source returned for one week, as recorded. */
export const sourceResultsSchema = z.array(z.object({ source: z.string(), outcome }));

/** One recorded week of source data the analyst is evaluated on. */
const analystEvalCaseSchema = z.object({
  name: z.string().min(1),
  product: z.object({ name: z.string().min(1) }),
  /** Claims the data cannot support (invented causes, signups, revenue…); none may appear. */
  forbidden: z.array(z.string().min(1)),
  /** The biggest change, as the summary might name it; it must mention one of these. */
  summaryMentions: z.array(z.string().min(1)).min(1),
  brief: z.object({
    audience: z.string(),
    problem: z.string(),
    solution: z.string(),
    differentiators: z.array(z.string()),
    tone: z.string(),
    facts: z.array(z.string()),
  }),
  week: z.object({ start: date, end: date }),
  results: sourceResultsSchema,
});

export type AnalystEvalCase = z.infer<typeof analystEvalCaseSchema>;

const briefText = ({ brief }: AnalystEvalCase) =>
  [brief.audience, brief.problem, brief.solution, ...brief.differentiators, ...brief.facts]
    .join("\n")
    .toLowerCase();

export const parseAnalystEvalCase = (json: unknown): Result<AnalystEvalCase, string> => {
  const parsed = analystEvalCaseSchema.safeParse(json);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid analyst eval case");
  // A claim the brief makes is one faithful notes may repeat, so it cannot be forbidden.
  const text = briefText(parsed.data);
  const inBrief = parsed.data.forbidden.find((claim) => text.includes(claim.toLowerCase()));
  return inBrief === undefined
    ? ok(parsed.data)
    : err(`Forbidden claim "${inBrief}" appears in the brief`);
};

/** The report the analyst reads, built by the same domain code the app uses. */
export const reportOf = (evalCase: AnalystEvalCase): WeeklyReport =>
  buildWeeklyReport({
    id: weeklyReportId(`eval_${evalCase.name}`),
    productId: productId(`eval_${evalCase.name}`),
    week: evalCase.week,
    results: evalCase.results,
    now: evalCase.week.end,
  });

/** Hype the prompt forbids; notes should read like a calm analyst. */
const HYPE = ["skyrocket", "explosive", "massive", "incredible", "huge", "!"];
const MAX_SUGGESTIONS = 3;

export interface AnalysisScore {
  readonly name: string;
  readonly analysed: boolean;
  /** Safety rule: every number stated is one the founder can see in the report. */
  readonly numbersFromReport: boolean;
  /** Safety rule: every cited fact is an approved brief fact. */
  readonly citesOnlyBriefFacts: boolean;
  readonly noForbiddenClaims: boolean;
  readonly noHype: boolean;
  readonly suggestionCount: boolean;
  readonly namesBiggestChange: boolean;
  readonly unknownNumbers: readonly string[];
  readonly passed: boolean;
  readonly error: string | undefined;
}

export const scoreAnalysis = (
  evalCase: AnalystEvalCase,
  report: WeeklyReport,
  result: Result<Analysis, AnalysisError>,
): AnalysisScore => {
  if (!result.ok) {
    return {
      name: evalCase.name,
      analysed: false,
      numbersFromReport: false,
      citesOnlyBriefFacts: false,
      noForbiddenClaims: false,
      noHype: false,
      suggestionCount: false,
      namesBiggestChange: false,
      unknownNumbers: [],
      passed: false,
      error: `${result.error.code}: ${result.error.message}`,
    };
  }
  const { summary, highlights, suggestions, citedFacts } = result.value;
  const text = [summary, ...highlights, ...suggestions].join("\n");
  const lower = text.toLowerCase();
  const unknownNumbers = numbersNotInReport(report, text);
  const checks = {
    numbersFromReport: unknownNumbers.length === 0,
    citesOnlyBriefFacts: citedFacts.every((fact) => evalCase.brief.facts.includes(fact)),
    noForbiddenClaims: evalCase.forbidden.every((c) => !lower.includes(c.toLowerCase())),
    noHype: HYPE.every((word) => !lower.includes(word)),
    suggestionCount: suggestions.length >= 1 && suggestions.length <= MAX_SUGGESTIONS,
    namesBiggestChange: evalCase.summaryMentions.some((m) =>
      summary.toLowerCase().includes(m.toLowerCase()),
    ),
  };
  return {
    name: evalCase.name,
    analysed: true,
    ...checks,
    unknownNumbers,
    passed: Object.values(checks).every(Boolean),
    error: undefined,
  };
};

export interface AnalysisSummary {
  readonly reports: number;
  readonly passRate: number;
  readonly meetsThresholds: boolean;
}

/** Threshold: every report passes every check (two of them are safety rules). */
export const summariseAnalyses = (scores: readonly AnalysisScore[]): AnalysisSummary => {
  const passRate = scores.length === 0 ? 0 : scores.filter((s) => s.passed).length / scores.length;
  return {
    reports: scores.length,
    passRate,
    meetsThresholds: meets(scores.length, { pass: passRate }, evalThresholds.analyst),
  };
};
