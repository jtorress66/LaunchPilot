import {
  numbersNotInReport,
  validateWeekPlan,
  type DropReason,
  type ProposedTask,
} from "@nuvantre/domain";
import type { CampaignPlan, PlanRequest } from "@nuvantre/ports";
import { HYPE_WORDS } from "../review/draft-checks";

const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const valueOf = (shown: string) => Number(shown.replaceAll(",", ""));

const dropMessage: Readonly<Record<Exclude<DropReason, "over_allowance">, string>> = {
  not_plannable: "is not an SEO article for the blog or a post for X or LinkedIn",
  unknown_keyword: "uses a keyword that was not offered",
  unknown_angle: "uses a post angle that was not offered for that channel",
  duplicate: "repeats another task",
  channel_full: "goes over its channel's weekly cap",
};

/** Figures in the plan's goal and rationales that neither last week's report nor a candidate has. */
const unsupportedFigures = (request: PlanRequest, plan: CampaignPlan) => {
  const text = [plan.goal, ...plan.tasks.map((t) => t.rationale)].join("\n");
  const fromCandidates = new Set(
    request.candidates.keywords.flatMap((k) => [k.monthlySearches, k.difficulty]),
  );
  const unknown =
    request.lastWeek === null
      ? (text.match(NUMBER) ?? []).filter((n) => valueOf(n) > 10)
      : numbersNotInReport(request.lastWeek, text).map(
          (n) => (text.match(NUMBER) ?? []).find((shown) => valueOf(shown) === Number(n)) ?? n,
        );
  return [...new Set(unknown.filter((n) => !fromCandidates.has(valueOf(n))))];
};

const titleOf = (task: ProposedTask) => `"${task.title}"`;

/** Every way a plan breaks the loop's rules, one line each; empty when it is fine. */
export const planProblems = (request: PlanRequest, plan: CampaignPlan): string[] => {
  const checked = validateWeekPlan(plan.tasks, request);
  const lower = [plan.name, plan.goal, ...plan.tasks.flatMap((t) => [t.title, t.rationale])]
    .join("\n")
    .toLowerCase();
  const hype = HYPE_WORDS.filter((word) => lower.includes(word));
  const figures = unsupportedFigures(request, plan);
  return [
    ...(plan.tasks.length === 0 ? ["Plan at least one task."] : []),
    ...(plan.goal.trim() === "" ? ["Give the week a goal."] : []),
    ...checked.dropped.flatMap(({ task, reason }) =>
      reason === "over_allowance" ? [] : [`${titleOf(task)} ${dropMessage[reason]}.`],
    ),
    ...(checked.dropped.some((d) => d.reason === "over_allowance")
      ? [`Plan at most ${String(request.allowance)} tasks: the plan's allowance.`]
      : []),
    ...(figures.length > 0
      ? [`These figures are in neither the report nor the candidates: ${figures.join(", ")}.`]
      : []),
    ...(hype.length > 0 ? [`Remove hype: ${hype.map((w) => `"${w}"`).join(", ")}.`] : []),
  ];
};
