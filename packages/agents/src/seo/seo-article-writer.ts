import { err, ok, type Result } from "@nuvantre/domain";
import type {
  ContentDrafter,
  Draft,
  DraftError,
  DraftRequest,
  LlmClient,
  LlmError,
} from "@nuvantre/ports";
import { SEO_SYSTEM_PROMPT, seoUserMessage } from "./prompt";
import { articleAnswer, articleAnswerJsonSchema, type ArticleAnswer } from "./schema";

const MAX_TOKENS = 16_000;

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

const parseAnswer = (text: string): Result<ArticleAnswer, DraftError> => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return err(failed("The model did not answer with JSON"));
  }
  const parsed = articleAnswer.safeParse(json);
  return parsed.success
    ? ok(parsed.data)
    : err(failed("The model's answer did not match the article format"));
};

/** Drafts one SEO article for the founder's blog. Drafting only: it never reviews or publishes. */
export class SeoArticleWriter implements ContentDrafter {
  constructor(private readonly llm: LlmClient) {}

  async draft(request: DraftRequest): Promise<Result<Draft, DraftError>> {
    const response = await this.llm.complete({
      system: SEO_SYSTEM_PROMPT,
      messages: [{ role: "user", content: seoUserMessage(request) }],
      maxTokens: MAX_TOKENS,
      responseFormat: { type: "json_schema", schema: articleAnswerJsonSchema },
    });
    if (!response.ok) return err(fromLlmError(response.error));
    if (response.value.stopReason === "max_tokens") {
      return err(failed("The article was cut off before it finished"));
    }
    const answer = parseAnswer(response.value.text);
    if (!answer.ok) return answer;

    const keyword = request.keywords?.[0]?.toLowerCase();
    const text = `${answer.value.title}\n${answer.value.body}`.toLowerCase();
    if (keyword !== undefined && !text.includes(keyword)) {
      return err(failed("The article does not mention its target keyword"));
    }
    return ok({
      title: answer.value.title,
      body: answer.value.body,
      citedFacts: answer.value.citedFacts.filter((fact) => request.brief.facts.includes(fact)),
    });
  }
}
