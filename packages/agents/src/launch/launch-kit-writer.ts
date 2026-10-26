import { communityChannels, err, ok, type Result } from "@nuvantre/domain";
import type {
  DraftError,
  LaunchKitDraft,
  LaunchKitDrafter,
  LaunchKitRequest,
  LlmClient,
  LlmError,
  LlmMessage,
} from "@nuvantre/ports";
import { kitProblems } from "./kit-rules";
import { LAUNCH_SYSTEM_PROMPT, launchUserMessage, rewriteMessage } from "./prompt";
import { kitAnswer, kitAnswerJsonSchema, type KitAnswer } from "./schema";

const MAX_TOKENS = 6_000;

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

const parseAnswer = (text: string): Result<KitAnswer, DraftError> => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return err(failed("The model did not answer with JSON"));
  }
  const parsed = kitAnswer.safeParse(json);
  return parsed.success
    ? ok(parsed.data)
    : err(failed("The model's answer did not match the launch kit format"));
};

const toDraft = (answer: KitAnswer, request: LaunchKitRequest): LaunchKitDraft => ({
  listing: answer.listing,
  community: communityChannels.map((channel) => ({ channel, ...answer.community[channel] })),
  citedFacts: answer.citedFacts.filter((fact) => request.brief.facts.includes(fact)),
});

/** Drafts a launch kit from the approved brief. Drafting only: it never submits anything. */
export class LaunchKitWriter implements LaunchKitDrafter {
  constructor(private readonly llm: LlmClient) {}

  async draft(request: LaunchKitRequest): Promise<Result<LaunchKitDraft, DraftError>> {
    const messages: LlmMessage[] = [{ role: "user", content: launchUserMessage(request) }];
    const first = await this.ask(messages);
    if (!first.ok) return first;
    const draft = toDraft(first.value, request);
    const problems = kitProblems(draft.listing, draft.community);
    if (problems.length === 0) return ok(draft);

    // One rewrite: models usually fix length and format slips when told exactly what is wrong.
    const second = await this.ask([
      ...messages,
      { role: "assistant", content: JSON.stringify(first.value) },
      { role: "user", content: rewriteMessage(problems) },
    ]);
    if (!second.ok) return second;
    const rewritten = toDraft(second.value, request);
    const remaining = kitProblems(rewritten.listing, rewritten.community);
    return remaining.length === 0
      ? ok(rewritten)
      : err(failed(`The launch kit still breaks the rules: ${remaining.join(" ")}`));
  }

  private async ask(messages: readonly LlmMessage[]): Promise<Result<KitAnswer, DraftError>> {
    const response = await this.llm.complete({
      system: LAUNCH_SYSTEM_PROMPT,
      messages,
      maxTokens: MAX_TOKENS,
      responseFormat: { type: "json_schema", schema: kitAnswerJsonSchema },
    });
    if (!response.ok) return err(fromLlmError(response.error));
    if (response.value.stopReason === "max_tokens") {
      return err(failed("The launch kit was cut off before it finished"));
    }
    return parseAnswer(response.value.text);
  }
}
