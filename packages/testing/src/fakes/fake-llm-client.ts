import { err, ok, type Result } from "@launchpilot/domain";
import type { LlmClient, LlmError, LlmRequest, LlmResponse } from "@launchpilot/ports";

/** Scripted LlmClient: queue replies or errors, then assert on the recorded requests. */
export class FakeLlmClient implements LlmClient {
  readonly requests: LlmRequest[] = [];
  private readonly script: Result<LlmResponse, LlmError>[] = [];

  reply(text: string, usage = { inputTokens: 10, outputTokens: 20 }): this {
    this.script.push(ok({ text, stopReason: "complete", usage }));
    return this;
  }

  fail(error: LlmError): this {
    this.script.push(err(error));
    return this;
  }

  complete(request: LlmRequest): Promise<Result<LlmResponse, LlmError>> {
    this.requests.push(request);
    return Promise.resolve(
      this.script.shift() ??
        err({
          code: "unavailable",
          message: "FakeLlmClient has no scripted response left",
          retryable: false,
        }),
    );
  }
}
