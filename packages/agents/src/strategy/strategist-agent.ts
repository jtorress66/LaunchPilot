import { err, ok, type ProposedTask, type Result } from "@nuvantre/domain";
import type {
  CampaignPlan,
  CampaignPlanner,
  LlmClient,
  LlmError,
  LlmMessage,
  PlanError,
  PlanRequest,
} from "@nuvantre/ports";
import { planProblems } from "./plan-rules";
import { rewriteMessage, STRATEGIST_SYSTEM_PROMPT, strategistUserMessage } from "./prompt";
import { planAnswer, planAnswerJsonSchema, type PlanAnswer } from "./schema";

const MAX_TOKENS = 3_000;

const failed = (message: string, retryable = true): PlanError => ({
  code: "planning_failed",
  message,
  retryable,
});

const fromLlmError = (error: LlmError): PlanError =>
  error.code === "rate_limited" || error.code === "unavailable"
    ? { code: "unavailable", message: error.message, retryable: true }
    : failed(error.message, false);

const parsePlan = (text: string): Result<CampaignPlan, PlanError> => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return err(failed("The model did not answer with JSON"));
  }
  const parsed = planAnswer.safeParse(json);
  if (!parsed.success) return err(failed("The model's answer did not match the plan format"));
  return ok(toPlan(parsed.data));
};

const toPlan = (answer: PlanAnswer): CampaignPlan => ({
  name: answer.name.trim(),
  goal: answer.goal.trim(),
  tasks: answer.tasks.map(({ keyword, angle, ...task }): ProposedTask => ({
    ...task,
    ...(keyword === null ? {} : { keyword }),
    ...(angle === null ? {} : { angle }),
  })),
});

/**
 * Plans the week from the brief, last week's report and the offered candidates. Planning only:
 * every task must use an offered keyword or angle, and every figure must come from the inputs.
 */
export class StrategistAgent implements CampaignPlanner {
  constructor(private readonly llm: LlmClient) {}

  async plan(request: PlanRequest): Promise<Result<CampaignPlan, PlanError>> {
    const messages: LlmMessage[] = [{ role: "user", content: strategistUserMessage(request) }];
    const first = await this.ask(messages);
    if (!first.ok) return first;
    const problems = planProblems(request, first.value);
    if (problems.length === 0) return first;

    // One rewrite: told exactly which tasks or figures are off, models fix them.
    const second = await this.ask([
      ...messages,
      { role: "assistant", content: JSON.stringify(first.value) },
      { role: "user", content: rewriteMessage(problems) },
    ]);
    if (!second.ok) return second;
    const remaining = planProblems(request, second.value);
    return remaining.length === 0
      ? second
      : err(failed(`The plan still breaks the rules: ${remaining.join(" ")}`));
  }

  private async ask(messages: readonly LlmMessage[]): Promise<Result<CampaignPlan, PlanError>> {
    const response = await this.llm.complete({
      system: STRATEGIST_SYSTEM_PROMPT,
      messages,
      maxTokens: MAX_TOKENS,
      responseFormat: { type: "json_schema", schema: planAnswerJsonSchema },
    });
    if (!response.ok) return err(fromLlmError(response.error));
    if (response.value.stopReason === "max_tokens") {
      return err(failed("The plan was cut off before it finished"));
    }
    return parsePlan(response.value.text);
  }
}
