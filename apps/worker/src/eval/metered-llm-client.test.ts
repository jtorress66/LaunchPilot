import { FakeLlmClient } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { MeteredLlmClient } from "./metered-llm-client";

const ask = { messages: [{ role: "user" as const, content: "hi" }], maxTokens: 10 };

describe("MeteredLlmClient", () => {
  it("passes results through and adds up token usage across calls", async () => {
    const inner = new FakeLlmClient()
      .reply("one", { inputTokens: 100, outputTokens: 10 })
      .reply("two", { inputTokens: 50, outputTokens: 5 })
      .fail({ code: "unavailable", message: "Down", retryable: true });
    const metered = new MeteredLlmClient(inner);
    const first = await metered.complete(ask);
    await metered.complete(ask);
    const failed = await metered.complete(ask);
    expect(first.ok && first.value.text).toBe("one");
    expect(failed.ok).toBe(false);
    expect(metered.usage).toEqual({ calls: 3, inputTokens: 150, outputTokens: 15 });
  });

  it("estimates cost from per-million-token prices", async () => {
    const metered = new MeteredLlmClient(
      new FakeLlmClient().reply("x", { inputTokens: 1_000_000, outputTokens: 100_000 }),
    );
    await metered.complete(ask);
    expect(metered.costUsd({ inputPerMillion: 4, outputPerMillion: 20 })).toBe(6);
  });
});
