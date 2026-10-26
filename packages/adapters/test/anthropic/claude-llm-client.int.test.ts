import type { LlmRequest } from "@nuvantre/ports";
import { describeLlmClientContract } from "@nuvantre/testing/contracts";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ClaudeLlmClient } from "../../src";
import fallback from "./recorded/fallback.json";
import invalidRequest from "./recorded/invalid-request-error.json";
import maxTokens from "./recorded/max-tokens.json";
import overloaded from "./recorded/overloaded-error.json";
import rateLimit from "./recorded/rate-limit-error.json";
import refusal from "./recorded/refusal.json";
import reply from "./recorded/reply.json";
import { sse } from "./sse";

const endpoint = "https://api.anthropic.com/v1/messages";
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const API_KEY = "sk-ant-recorded-test-key";

const client = () => new ClaudeLlmClient({ apiKey: API_KEY, maxRetries: 0 });

const stream = (message: Parameters<typeof sse>[0]) =>
  new HttpResponse(sse(message), { headers: { "content-type": "text/event-stream" } });

interface Captured {
  body: Record<string, unknown>;
  headers: Headers;
}

const answerWith = (message: Parameters<typeof sse>[0]): Captured => {
  const captured: Captured = { body: {}, headers: new Headers() };
  server.use(
    http.post(endpoint, async ({ request }) => {
      captured.body = (await request.json()) as Record<string, unknown>;
      captured.headers = request.headers;
      return stream(message);
    }),
  );
  return captured;
};

const failWith = (status: number, body: JsonBodyType) => {
  server.use(http.post(endpoint, () => HttpResponse.json(body, { status })));
};

describeLlmClientContract("ClaudeLlmClient (recorded API)", () => ({
  client: client(),
  givenReply: (text) => {
    answerWith({ ...reply, content: [{ type: "text", text }] });
  },
  givenOutage: () => {
    failWith(529, overloaded);
  },
}));

const request: LlmRequest = {
  system: "You are a positioning strategist.",
  messages: [{ role: "user", content: "Draft the brief." }],
  maxTokens: 16_000,
  responseFormat: { type: "json_schema", schema: { type: "object" } },
};

describe("ClaudeLlmClient", () => {
  it("sends a streamed Opus 5.5 request with adaptive thinking, effort, caching and structured output", async () => {
    const captured = answerWith(reply);
    await client().complete(request);
    expect(captured.body).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 16_000,
      stream: true,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: { type: "object" } },
      },
      system: [
        {
          type: "text",
          text: "You are a positioning strategist.",
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: "Draft the brief." }],
      fallbacks: "default",
    });
    expect(captured.headers.get("anthropic-beta")).toBe("server-side-fallback-2026-07-01");
    expect(captured.headers.get("x-api-key")).toBe(API_KEY);
  });

  it("uses the configured model and effort, and omits optional fields it was not given", async () => {
    const captured = answerWith(reply);
    await new ClaudeLlmClient({
      apiKey: API_KEY,
      model: "claude-sonnet-5-5",
      effort: "low",
      maxRetries: 0,
    }).complete({ messages: request.messages, maxTokens: 100 });
    expect(captured.body).toMatchObject({
      model: "claude-sonnet-5-5",
      output_config: { effort: "low" },
    });
    expect(captured.body).not.toHaveProperty("system");
    expect(captured.body.output_config).not.toHaveProperty("format");
  });

  it("returns the answer text and token usage, skipping thinking blocks", async () => {
    answerWith(reply);
    expect(await client().complete(request)).toEqual({
      ok: true,
      value: {
        text: "Hello, founder!",
        stopReason: "complete",
        usage: { inputTokens: 412, outputTokens: 58 },
      },
    });
  });

  it("keeps only the fallback model's answer when the first model declined mid-answer", async () => {
    answerWith(fallback);
    const result = await client().complete(request);
    expect(result.ok && result.value.text).toBe('{"answer":"from the fallback model"}');
  });

  it("reports an answer cut off at the token limit", async () => {
    answerWith(maxTokens);
    const result = await client().complete(request);
    expect(result.ok && result.value.stopReason).toBe("max_tokens");
  });

  it("reports a refusal that no fallback model could answer", async () => {
    answerWith(refusal);
    expect(await client().complete(request)).toEqual({
      ok: false,
      error: { code: "refused", message: expect.any(String) as unknown, retryable: false },
    });
  });

  it.each([
    [429, rateLimit, "rate_limited", true],
    [529, overloaded, "unavailable", true],
    [500, overloaded, "unavailable", true],
    [400, invalidRequest, "invalid_request", false],
    [401, invalidRequest, "invalid_request", false],
  ] as const)("maps HTTP %i to %s", async (status, body, code, retryable) => {
    failWith(status, body);
    const result = await client().complete(request);
    expect(result).toMatchObject({ ok: false, error: { code, retryable } });
  });

  it("maps a network failure to unavailable", async () => {
    server.use(http.post(endpoint, () => HttpResponse.error()));
    const result = await client().complete(request);
    expect(result).toMatchObject({ ok: false, error: { code: "unavailable", retryable: true } });
  });

  it("never puts the API key or the prompt in an error message", async () => {
    failWith(400, invalidRequest);
    const result = await client().complete(request);
    if (result.ok) throw new Error("expected an error");
    expect(result.error.message).not.toContain(API_KEY);
    expect(result.error.message).not.toContain("Draft the brief");
  });
});
