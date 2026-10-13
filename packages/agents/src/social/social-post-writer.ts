import { err, maxLengthOf, ok, type Result } from "@launchpilot/domain";
import type {
  ContentDrafter,
  Draft,
  DraftError,
  DraftRequest,
  LlmClient,
  LlmError,
  LlmMessage,
} from "@launchpilot/ports";
import { rewriteMessage, SOCIAL_SYSTEM_PROMPT, socialUserMessage } from "./prompt";
import { postAnswer, postAnswerJsonSchema, type PostAnswer } from "./schema";

const MAX_TOKENS = 2_000;
const TITLE_MAX = 200;

const failed = (message: string, retryable = true): DraftError => ({
  code: "generation_failed",
  message,
  retryable,
});

/** Outages are worth retrying; anything the model or API refused is a failed draft. */
const fromLlmError = (error: LlmError): DraftError =>
  error.code === "rate_limited" || error.code === "unavailable"
    ? { code: "unavailable", message: error.message, retryable: true }
    : failed(error.message, false);

const parseAnswer = (text: string): Result<PostAnswer, DraftError> => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return err(failed("The model did not answer with JSON"));
  }
  const parsed = postAnswer.safeParse(json);
  return parsed.success
    ? ok(parsed.data)
    : err(failed("The model's answer did not match the post format"));
};

/** What is wrong with a post the founder could otherwise review, or undefined if nothing. */
const problemWith = (text: string, request: DraftRequest): string | undefined => {
  const limit = maxLengthOf(request.channel);
  if (text.length > limit) {
    return `The post is ${String(text.length)} characters; the limit is ${String(limit)}.`;
  }
  if (request.link !== undefined && !text.includes(request.link)) {
    return `The post must include this link exactly: ${request.link}`;
  }
  return undefined;
};

/** Drafts one X or LinkedIn post. Drafting only: it never reviews, schedules or publishes. */
export class SocialPostWriter implements ContentDrafter {
  constructor(private readonly llm: LlmClient) {}

  async draft(request: DraftRequest): Promise<Result<Draft, DraftError>> {
    const messages: LlmMessage[] = [{ role: "user", content: socialUserMessage(request) }];
    const first = await this.ask(messages);
    if (!first.ok) return first;
    const problem = problemWith(first.value.text, request);
    if (problem === undefined) return ok(this.toDraft(first.value, request));

    // One rewrite: models usually fix a length or link slip when told exactly what was wrong.
    const second = await this.ask([
      ...messages,
      { role: "assistant", content: JSON.stringify(first.value) },
      { role: "user", content: rewriteMessage(problem) },
    ]);
    if (!second.ok) return second;
    const remaining = problemWith(second.value.text, request);
    return remaining === undefined
      ? ok(this.toDraft(second.value, request))
      : err(failed(`The post still breaks the channel rules: ${remaining}`));
  }

  private async ask(messages: readonly LlmMessage[]): Promise<Result<PostAnswer, DraftError>> {
    const response = await this.llm.complete({
      system: SOCIAL_SYSTEM_PROMPT,
      messages,
      maxTokens: MAX_TOKENS,
      responseFormat: { type: "json_schema", schema: postAnswerJsonSchema },
    });
    if (!response.ok) return err(fromLlmError(response.error));
    if (response.value.stopReason === "max_tokens") {
      return err(failed("The post was cut off before it finished"));
    }
    return parseAnswer(response.value.text);
  }

  private toDraft(answer: PostAnswer, request: DraftRequest): Draft {
    return {
      title: request.task.title.trim().slice(0, TITLE_MAX),
      body: answer.text,
      citedFacts: answer.citedFacts.filter((fact) => request.brief.facts.includes(fact)),
    };
  }
}
