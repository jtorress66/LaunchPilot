import {
  buildWeeklyReport,
  err,
  numbersNotInReport,
  ok,
  planPostAngles,
  productId,
  validateWeekPlan,
  weeklyReportId,
  type Result,
} from "@launchpilot/domain";
import type { CampaignPlan, PlanError, PlanRequest } from "@launchpilot/ports";
import { z } from "zod";
import { sourceResultsSchema } from "./analyst-eval";

const date = z.coerce.date();
const week = z.object({ start: date, end: date });

/** One recorded week the strategist plans: the brief, last week's sources and the keywords. */
const strategistEvalCaseSchema = z.object({
  name: z.string().min(1),
  product: z.object({ name: z.string().min(1) }),
  brief: z.object({
    audience: z.string(),
    problem: z.string(),
    solution: z.string(),
    differentiators: z.array(z.string()),
    tone: z.string(),
    facts: z.array(z.string()),
  }),
  week,
  /** Null in a product's first week, before there is a report. */
  lastWeek: z.object({ week, results: sourceResultsSchema }).nullable(),
  allowance: z.number().int().positive(),
  keywords: z
    .array(
      z.object({
        keyword: z.string().min(1),
        monthlySearches: z.number().nonnegative(),
        difficulty: z.number().min(0).max(100),
      }),
    )
    .min(1),
});

export type StrategistEvalCase = z.infer<typeof strategistEvalCaseSchema>;

export const parseStrategistEvalCase = (json: unknown): Result<StrategistEvalCase, string> => {
  const parsed = strategistEvalCaseSchema.safeParse(json);
  return parsed.success
    ? ok(parsed.data)
    : err(parsed.error.issues[0]?.message ?? "Invalid strategist eval case");
};

/** The request the weekly loop would send, built by the same domain code the app uses. */
export const planRequestOf = (evalCase: StrategistEvalCase): PlanRequest => ({
  product: evalCase.product,
  brief: evalCase.brief,
  week: evalCase.week,
  lastWeek: evalCase.lastWeek
    ? buildWeeklyReport({
        id: weeklyReportId(`eval_${evalCase.name}`),
        productId: productId(`eval_${evalCase.name}`),
        week: evalCase.lastWeek.week,
        results: evalCase.lastWeek.results,
        now: evalCase.lastWeek.week.end,
      })
    : null,
  allowance: evalCase.allowance,
  candidates: {
    keywords: evalCase.keywords,
    angles: planPostAngles(evalCase.brief, { x: 3, linkedin: 2 }),
  },
});

/** Hype the prompt forbids; a plan should read like a calm marketer's. */
const HYPE = ["revolutionary", "game-changing", "skyrocket", "explosive", "viral", "!"];
const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const valueOf = (shown: string) => Number(shown.replaceAll(",", ""));
const UNGROUNDED = new Set(["not_plannable", "unknown_keyword", "unknown_angle", "duplicate"]);

/** Figures the report, the keywords, the brief and the week's dates lack; small counts are wording. */
const unknownFiguresIn = (request: PlanRequest, text: string) => {
  const { brief } = request;
  const briefText = [brief.audience, brief.problem, brief.solution, ...brief.differentiators]
    .concat(brief.facts)
    .join("\n");
  const known = new Set([
    ...request.candidates.keywords.flatMap((k) => [k.monthlySearches, k.difficulty]),
    ...(briefText.match(NUMBER) ?? []).map(valueOf),
    ...[request.week.start, request.week.end].flatMap((d) => [
      d.getUTCDate(),
      d.getUTCMonth() + 1,
      d.getUTCFullYear(),
    ]),
  ]);
  const shown = text.match(NUMBER) ?? [];
  const notInReport = new Set(
    request.lastWeek ? numbersNotInReport(request.lastWeek, text).map(Number) : shown.map(valueOf),
  );
  const unknown = shown.filter(
    (n) => valueOf(n) > 10 && notInReport.has(valueOf(n)) && !known.has(valueOf(n)),
  );
  return [...new Set(unknown)];
};

export interface PlanScore {
  readonly name: string;
  readonly planned: boolean;
  /** Safety rule: every task uses an offered keyword or angle, on a channel the loop may plan. */
  readonly grounded: boolean;
  readonly withinLimits: boolean;
  /** Safety rule: every figure is one the report, the keyword research or the brief shows. */
  readonly figuresGrounded: boolean;
  readonly hasGoal: boolean;
  readonly noHype: boolean;
  readonly mixesArticlesAndPosts: boolean;
  readonly unknownFigures: readonly string[];
  readonly passed: boolean;
  readonly error: string | undefined;
}

export const scorePlan = (
  evalCase: StrategistEvalCase,
  request: PlanRequest,
  result: Result<CampaignPlan, PlanError>,
): PlanScore => {
  if (!result.ok) {
    return {
      name: evalCase.name,
      planned: false,
      grounded: false,
      withinLimits: false,
      figuresGrounded: false,
      hasGoal: false,
      noHype: false,
      mixesArticlesAndPosts: false,
      unknownFigures: [],
      passed: false,
      error: `${result.error.code}: ${result.error.message}`,
    };
  }
  const plan = result.value;
  const { dropped } = validateWeekPlan(plan.tasks, request);
  const text = [plan.name, plan.goal, ...plan.tasks.flatMap((t) => [t.title, t.rationale])].join(
    "\n",
  );
  const unknownFigures = unknownFiguresIn(request, text);
  const kinds = new Set(plan.tasks.map((t) => t.kind));
  const checks = {
    grounded: plan.tasks.length > 0 && dropped.every((d) => !UNGROUNDED.has(d.reason)),
    withinLimits: dropped.every((d) => UNGROUNDED.has(d.reason)),
    figuresGrounded: unknownFigures.length === 0,
    hasGoal: plan.goal.trim() !== "",
    noHype: HYPE.every((word) => !text.toLowerCase().includes(word)),
    mixesArticlesAndPosts:
      request.allowance < 2 || (kinds.has("seo_article") && kinds.has("social_post")),
  };
  return {
    name: evalCase.name,
    planned: true,
    ...checks,
    unknownFigures,
    passed: Object.values(checks).every(Boolean),
    error: undefined,
  };
};

export interface PlanSummary {
  readonly plans: number;
  readonly passRate: number;
  readonly meetsThresholds: boolean;
}

/** Threshold: every week's plan passes every check (two of them are safety rules). */
export const summarisePlans = (scores: readonly PlanScore[]): PlanSummary => {
  const passRate = scores.length === 0 ? 0 : scores.filter((s) => s.passed).length / scores.length;
  return { plans: scores.length, passRate, meetsThresholds: scores.length > 0 && passRate === 1 };
};
