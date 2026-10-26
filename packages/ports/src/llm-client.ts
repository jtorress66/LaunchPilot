import type { Result } from "@nuvantre/domain";
import type { PortError } from "./port-error";

export interface LlmMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface LlmRequest {
  readonly system?: string;
  readonly messages: readonly LlmMessage[];
  readonly maxTokens: number;
  readonly temperature?: number;
  /** Ask for JSON matching this schema; providers map it to their structured output feature. */
  readonly responseFormat?: { readonly type: "json_schema"; readonly schema: JsonSchema };
}

export type JsonSchema = Readonly<Record<string, unknown>>;

export interface LlmResponse {
  readonly text: string;
  readonly stopReason: "complete" | "max_tokens";
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}

export type LlmError = PortError<"rate_limited" | "unavailable" | "invalid_request" | "refused">;

/** Provider-neutral text completion. Agents talk to models only through this port. */
export interface LlmClient {
  complete(request: LlmRequest): Promise<Result<LlmResponse, LlmError>>;
}
