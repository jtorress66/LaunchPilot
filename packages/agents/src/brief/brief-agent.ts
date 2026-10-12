import { err, keepGroundedFacts, ok, type Result } from "@launchpilot/domain";
import type {
  BriefDraft,
  BriefDraftError,
  BriefDrafter,
  BriefDraftRequest,
  LlmClient,
} from "@launchpilot/ports";
import { BRIEF_SYSTEM_PROMPT, briefUserMessage } from "./prompt";
import { briefAnswer, briefAnswerJsonSchema, type BriefAnswer } from "./schema";
import { siteCorpus } from "./site-corpus";

const MAX_TOKENS = 16_000;

const failed = (message: string): BriefDraftError => ({
  code: "generation_failed",
  message,
  retryable: true,
});

const parseAnswer = (text: string): Result<BriefAnswer, BriefDraftError> => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return err(failed("The model did not answer with JSON"));
  }
  const parsed = briefAnswer.safeParse(json);
  return parsed.success
    ? ok(parsed.data)
    : err(failed("The model's answer did not match the brief format"));
};

/**
 * Drafts a Product Brief from the founder's crawled site with an LLM.
 * Facts the site does not support are dropped and reported, never kept.
 */
export class BriefAgent implements BriefDrafter {
  constructor(private readonly llm: LlmClient) {}

  async draft(request: BriefDraftRequest): Promise<Result<BriefDraft, BriefDraftError>> {
    const response = await this.llm.complete({
      system: BRIEF_SYSTEM_PROMPT,
      messages: [{ role: "user", content: briefUserMessage(request) }],
      maxTokens: MAX_TOKENS,
      responseFormat: { type: "json_schema", schema: briefAnswerJsonSchema },
    });
    if (!response.ok) return response;
    if (response.value.stopReason === "max_tokens") {
      return err(failed("The model's answer was cut off before it finished"));
    }
    const answer = parseAnswer(response.value.text);
    if (!answer.ok) return answer;
    return this.ground(answer.value, siteCorpus(request.site));
  }

  private ground(answer: BriefAnswer, corpus: string): Result<BriefDraft, BriefDraftError> {
    const { kept, dropped } = keepGroundedFacts(answer.facts, corpus);
    if (kept.length === 0) {
      return err({
        code: "ungrounded",
        message: "None of the drafted facts could be found on the site",
        retryable: true,
      });
    }
    return ok({
      content: {
        audience: answer.audience,
        problem: answer.problem,
        solution: answer.solution,
        differentiators: answer.differentiators,
        tone: answer.tone,
        facts: kept.map((fact) => fact.statement),
      },
      evidence: kept,
      droppedClaims: dropped,
    });
  }
}
