import type { Result } from "@nuvantre/domain";
import type { LlmClient, LlmError, LlmRequest, LlmResponse } from "@nuvantre/ports";

export interface TokenPrices {
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
}

/** Decorates any LlmClient to count calls and tokens, so evals can report what they cost. */
export class MeteredLlmClient implements LlmClient {
  readonly usage = { calls: 0, inputTokens: 0, outputTokens: 0 };

  constructor(private readonly inner: LlmClient) {}

  async complete(request: LlmRequest): Promise<Result<LlmResponse, LlmError>> {
    const result = await this.inner.complete(request);
    this.usage.calls += 1;
    if (result.ok) {
      this.usage.inputTokens += result.value.usage.inputTokens;
      this.usage.outputTokens += result.value.usage.outputTokens;
    }
    return result;
  }

  costUsd(prices: TokenPrices): number {
    return (
      (this.usage.inputTokens * prices.inputPerMillion +
        this.usage.outputTokens * prices.outputPerMillion) /
      1_000_000
    );
  }
}
