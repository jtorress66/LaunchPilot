import type { DraftRequest } from "@launchpilot/ports";
import { aBriefContent, FakeLlmClient } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { SocialPostWriter } from "./social-post-writer";

const request: DraftRequest = {
  brief: aBriefContent(),
  channel: "x",
  task: { kind: "social_post", title: "Why it matters: No cookies" },
};

const withLink: DraftRequest = {
  ...request,
  task: { kind: "social_post", title: "New article: Cookieless analytics guide" },
  link: "https://blog.acme.dev/guide",
};

const reply = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    text: "No cookies, no consent banner. Analytics that respect your visitors. Free 14-day trial.",
    citedFacts: ["Free 14-day trial"],
    ...overrides,
  });

const write = (llm: FakeLlmClient, req: DraftRequest = request) =>
  new SocialPostWriter(llm).draft(req);

const prompts = (llm: FakeLlmClient) =>
  llm.requests.map((r) => r.messages.map((m) => m.content).join("\n"));

describe("SocialPostWriter", () => {
  it("briefs the model with the channel, the angle, the brief's facts and tone", async () => {
    const llm = new FakeLlmClient().reply(reply());
    await write(llm);
    const [prompt = ""] = prompts(llm);
    expect(prompt).toContain("Channel: X");
    expect(prompt).toContain("at most 280 characters");
    expect(prompt).toContain("Why it matters: No cookies");
    for (const fact of request.brief.facts) expect(prompt).toContain(fact);
    expect(prompt).toContain(request.brief.tone);
  });

  it("gives LinkedIn its own guidance and limit", async () => {
    const llm = new FakeLlmClient().reply(reply());
    await write(llm, { ...request, channel: "linkedin" });
    const [prompt = ""] = prompts(llm);
    expect(prompt).toContain("Channel: LinkedIn");
    expect(prompt).toContain("at most 3000 characters");
  });

  it("asks for the link to be included when the post promotes an article", async () => {
    const llm = new FakeLlmClient().reply(reply({ text: "New guide: https://blog.acme.dev/guide" }));
    const result = await write(llm, withLink);
    expect(prompts(llm)[0]).toContain("Include this link exactly: https://blog.acme.dev/guide");
    expect(result.ok).toBe(true);
  });

  it("keeps the system prompt identical across posts so it can be cached", async () => {
    const llm = new FakeLlmClient().reply(reply()).reply(reply());
    await write(llm);
    await write(llm, { ...request, channel: "linkedin" });
    const [first, second] = llm.requests;
    expect(first?.system).toBeTruthy();
    expect(first?.system).toBe(second?.system);
    expect(first?.system).not.toContain("No cookies");
  });

  it("asks for JSON matching the post schema", async () => {
    const llm = new FakeLlmClient().reply(reply());
    await write(llm);
    expect(llm.requests[0]?.responseFormat).toMatchObject({
      type: "json_schema",
      schema: { required: ["text", "citedFacts"] },
    });
  });

  it("returns the post, titled after its angle, citing only brief facts", async () => {
    const llm = new FakeLlmClient().reply(
      reply({ citedFacts: ["Free 14-day trial", "Used by 10,000 teams"] }),
    );
    expect(await write(llm)).toEqual({
      ok: true,
      value: {
        title: "Why it matters: No cookies",
        body: "No cookies, no consent banner. Analytics that respect your visitors. Free 14-day trial.",
        citedFacts: ["Free 14-day trial"],
      },
    });
  });

  it("asks once for a shorter version when the post is over the channel limit", async () => {
    const llm = new FakeLlmClient()
      .reply(reply({ text: "a".repeat(281) }))
      .reply(reply({ text: "Short and sweet." }));
    const result = await write(llm);
    expect(result.ok && result.value.body).toBe("Short and sweet.");
    expect(llm.requests).toHaveLength(2);
    expect(prompts(llm)[1]).toContain("281 characters");
  });

  it("fails when the rewrite is still too long", async () => {
    const long = reply({ text: "a".repeat(281) });
    const llm = new FakeLlmClient().reply(long).reply(long);
    expect(await write(llm)).toMatchObject({ ok: false, error: { code: "generation_failed" } });
    expect(llm.requests).toHaveLength(2);
  });

  it("fails when the post leaves out the link it must include", async () => {
    const missing = reply({ text: "Read our new guide." });
    const llm = new FakeLlmClient().reply(missing).reply(missing);
    expect(await write(llm, withLink)).toMatchObject({
      ok: false,
      error: { code: "generation_failed" },
    });
  });

  it.each([
    ["text that is not JSON", "Here is your post"],
    ["JSON with the wrong shape", JSON.stringify({ title: "x" })],
    ["an empty post", reply({ text: "   " })],
  ])("fails as generation_failed on %s", async (_, text) => {
    const result = await write(new FakeLlmClient().reply(text));
    expect(result.ok ? undefined : result.error.code).toBe("generation_failed");
  });

  it.each([
    [{ code: "rate_limited", message: "Slow", retryable: true }, "unavailable", true],
    [{ code: "unavailable", message: "Down", retryable: true }, "unavailable", true],
    [{ code: "refused", message: "No", retryable: false }, "generation_failed", false],
  ] as const)("maps model error %o to %s", async (error, code, retryable) => {
    const result = await write(new FakeLlmClient().fail(error));
    expect(result).toMatchObject({ ok: false, error: { code, retryable } });
  });
});
