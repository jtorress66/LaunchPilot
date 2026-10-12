import Anthropic from "@anthropic-ai/sdk";
import type { BetaContentBlock, BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages";
import { err, ok, type Result } from "@launchpilot/domain";
import type { LlmClient, LlmError, LlmRequest, LlmResponse } from "@launchpilot/ports";

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";

/** Server-side refusal fallback: a declined request is re-run on Anthropic's recommended model. */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export type ClaudeEffort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ClaudeLlmClientOptions {
  readonly apiKey: string;
  readonly model?: string;
  readonly effort?: ClaudeEffort;
  /** SDK retries for rate limits and overloads before an error is returned. */
  readonly maxRetries?: number;
}

const llmError = (code: LlmError["code"], message: string, retryable: boolean): LlmError => ({
  code,
  message,
  retryable,
});

/** Never includes response bodies, prompts or keys: only the status. */
const mapError = (error: unknown): LlmError => {
  if (error instanceof Anthropic.APIConnectionError) {
    return llmError("unavailable", "Could not reach the Claude API", true);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return llmError("rate_limited", "The Claude API rate limit was reached", true);
  }
  if (error instanceof Anthropic.APIError) {
    const reported: unknown = error.status;
    const status = typeof reported === "number" ? reported : 0;
    if (status === 529 || status >= 500) {
      return llmError("unavailable", `The Claude API is unavailable (HTTP ${status})`, true);
    }
    return llmError(
      "invalid_request",
      `The Claude API rejected the request (HTTP ${status})`,
      false,
    );
  }
  throw error;
};

/** After a fallback, only the blocks the final model wrote form the answer. */
const answerText = (content: readonly BetaContentBlock[]): string => {
  const lastFallback = content.findLastIndex((block) => block.type === "fallback");
  return content
    .slice(lastFallback + 1)
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");
};

const toResponse = (message: BetaMessage): Result<LlmResponse, LlmError> => {
  if (message.stop_reason === "refusal") {
    return err(llmError("refused", "Claude declined to answer this request", false));
  }
  if (message.stop_reason === "model_context_window_exceeded") {
    return err(llmError("invalid_request", "The request is too long for the model", false));
  }
  return ok({
    text: answerText(message.content),
    stopReason: message.stop_reason === "max_tokens" ? "max_tokens" : "complete",
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
  });
};

/**
 * LlmClient on the Claude API. Thinking is adaptive, the system prompt is cached,
 * the request is streamed so long answers never hit HTTP timeouts, and refusals
 * fall back server-side before being reported. Sampling parameters such as
 * `temperature` are not sent: current Claude models reject non-default values.
 */
export class ClaudeLlmClient implements LlmClient {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly effort: ClaudeEffort;

  constructor(options: ClaudeLlmClientOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey, maxRetries: options.maxRetries ?? 2 });
    this.model = options.model ?? DEFAULT_CLAUDE_MODEL;
    this.effort = options.effort ?? "medium";
  }

  async complete(request: LlmRequest): Promise<Result<LlmResponse, LlmError>> {
    try {
      const message = await this.client.beta.messages
        .stream({
          model: this.model,
          max_tokens: request.maxTokens,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          thinking: { type: "adaptive" },
          output_config: {
            effort: this.effort,
            ...(request.responseFormat && {
              format: { type: "json_schema", schema: { ...request.responseFormat.schema } },
            }),
          },
          ...(request.system !== undefined && {
            system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
          }),
          messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        })
        .finalMessage();
      return toResponse(message);
    } catch (error) {
      return err(mapError(error));
    }
  }
}
