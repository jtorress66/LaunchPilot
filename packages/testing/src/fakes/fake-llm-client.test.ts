import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "./fake-llm-client";

const ask = (content: string) => ({
  messages: [{ role: "user" as const, content }],
  maxTokens: 50,
});

describe("FakeLlmClient", () => {
  it("returns scripted replies in order and records every request", async () => {
    const client = new FakeLlmClient().reply("first").reply("second");
    const a = await client.complete(ask("one"));
    const b = await client.complete(ask("two"));
    expect([a.ok && a.value.text, b.ok && b.value.text]).toEqual(["first", "second"]);
    expect(client.requests.map((r) => r.messages[0]?.content)).toEqual(["one", "two"]);
  });

  it("returns a scripted error", async () => {
    const error = { code: "rate_limited", message: "Slow down", retryable: true } as const;
    const client = new FakeLlmClient().fail(error);
    expect(await client.complete(ask("x"))).toEqual({ ok: false, error });
  });

  it("returns a non-retryable error once the script runs out so tests notice unexpected calls", async () => {
    const result = await new FakeLlmClient().complete(ask("x"));
    expect(result).toMatchObject({ ok: false, error: { code: "unavailable", retryable: false } });
  });
});
