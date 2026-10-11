import type { LlmClient } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";

export interface LlmClientHarness {
  readonly client: LlmClient;
  /** Arrange for the model to answer the next request with `text`. */
  givenReply(text: string): void | Promise<void>;
  /** Arrange for the provider to be unavailable on the next request. */
  givenOutage(): void | Promise<void>;
}

const request = { messages: [{ role: "user" as const, content: "Say hello" }], maxTokens: 64 };

export function describeLlmClientContract(
  name: string,
  make: () => LlmClientHarness | Promise<LlmClientHarness>,
): void {
  describe(`LlmClient contract: ${name}`, () => {
    it("returns the model's reply with token usage", async () => {
      const harness = await make();
      await harness.givenReply("Hello, founder!");
      const result = await harness.client.complete(request);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.text).toBe("Hello, founder!");
      expect(["complete", "max_tokens"]).toContain(result.value.stopReason);
      expect(result.value.usage.inputTokens).toBeGreaterThanOrEqual(0);
      expect(result.value.usage.outputTokens).toBeGreaterThanOrEqual(0);
    });

    it("reports an outage as an LlmError result instead of throwing", async () => {
      const harness = await make();
      await harness.givenOutage();
      const result = await harness.client.complete(request);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(["rate_limited", "unavailable"]).toContain(result.error.code);
      expect(result.error.message).not.toBe("");
      expect(typeof result.error.retryable).toBe("boolean");
    });
  });
}
