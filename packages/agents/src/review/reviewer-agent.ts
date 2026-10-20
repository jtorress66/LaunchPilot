import { err, ok, type Result } from "@launchpilot/domain";
import type {
  ContentReviewer,
  LlmClient,
  LlmError,
  ReviewError,
  ReviewRequest,
  ReviewVerdict,
} from "@launchpilot/ports";
import { draftBlockers, isEmptyDraft } from "./draft-checks";
import { REVIEWER_SYSTEM_PROMPT, reviewerUserMessage } from "./prompt";
import { verdictAnswer, verdictAnswerJsonSchema } from "./schema";

const MAX_TOKENS = 1_500;

const failed = (message: string, retryable = true): ReviewError => ({
  code: "review_failed",
  message,
  retryable,
});

const fromLlmError = (error: LlmError): ReviewError =>
  error.code === "rate_limited" || error.code === "unavailable"
    ? { code: "unavailable", message: error.message, retryable: true }
    : failed(error.message, false);

const parseVerdict = (text: string): Result<ReviewVerdict, ReviewError> => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return err(failed("The model did not answer with JSON"));
  }
  const parsed = verdictAnswer.safeParse(json);
  if (!parsed.success) return err(failed("The model's answer did not match the review format"));
  const { decision, issues } = parsed.data;
  // A blocker can never pass, whatever the model concluded.
  return ok({
    decision: issues.some((i) => i.severity === "blocker") ? "needs_changes" : decision,
    issues,
  });
};

/**
 * Reviews a draft against the brief and the channel. The rule checks run first and block without
 * a model call; the model then looks for unsupported claims and clarity. Reviewing only.
 */
export class ReviewerAgent implements ContentReviewer {
  constructor(private readonly llm: LlmClient) {}

  async review(request: ReviewRequest): Promise<Result<ReviewVerdict, ReviewError>> {
    if (isEmptyDraft(request)) return err(failed("The draft is empty", false));
    const blockers = draftBlockers(request);
    if (blockers.length > 0) return ok({ decision: "needs_changes", issues: blockers });
    const response = await this.llm.complete({
      system: REVIEWER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: reviewerUserMessage(request) }],
      maxTokens: MAX_TOKENS,
      responseFormat: { type: "json_schema", schema: verdictAnswerJsonSchema },
    });
    if (!response.ok) return err(fromLlmError(response.error));
    if (response.value.stopReason === "max_tokens") {
      return err(failed("The review was cut off before it finished"));
    }
    return parseVerdict(response.value.text);
  }
}
