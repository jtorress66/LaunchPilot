import type { LaunchKitRequest } from "@launchpilot/ports";
import { aBriefContent, aListing, FakeLlmClient } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { LaunchKitWriter } from "./launch-kit-writer";

const request: LaunchKitRequest = {
  brief: aBriefContent(),
  product: { name: "Acme Analytics", url: "https://acme.dev/" },
};

const community = {
  hackernews: {
    title: "Show HN: Acme Analytics – the five numbers that matter, weekly",
    body: "I built Acme because dashboards were eating my week. Feedback welcome.",
  },
  reddit: { title: "I built a cookieless analytics tool", body: "Free 14-day trial." },
  indiehackers: { title: "Launching Acme Analytics", body: "Here is why we built it." },
};

const reply = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    listing: aListing(),
    community,
    citedFacts: ["Free 14-day trial"],
    ...overrides,
  });

const write = (llm: FakeLlmClient) => new LaunchKitWriter(llm).draft(request);
const prompts = (llm: FakeLlmClient) =>
  llm.requests.map((r) => r.messages.map((m) => m.content).join("\n"));

describe("LaunchKitWriter", () => {
  it("briefs the model with the product, the brief's facts and every field limit", async () => {
    const llm = new FakeLlmClient().reply(reply());
    await write(llm);
    const [prompt = ""] = prompts(llm);
    expect(prompt).toContain("Product: Acme Analytics (https://acme.dev/)");
    for (const fact of request.brief.facts) expect(prompt).toContain(fact);
    expect(prompt).toContain(request.brief.tone);
    expect(llm.requests[0]?.system).toContain("tagline: at most 60 characters");
    expect(llm.requests[0]?.system).toContain("Show HN");
  });

  it("keeps the system prompt free of per-product data so it can be cached", async () => {
    const llm = new FakeLlmClient().reply(reply());
    await write(llm);
    expect(llm.requests[0]?.system).not.toContain("Acme");
  });

  it("asks for JSON matching the kit schema", async () => {
    const llm = new FakeLlmClient().reply(reply());
    await write(llm);
    expect(llm.requests[0]?.responseFormat).toMatchObject({
      type: "json_schema",
      schema: { required: ["listing", "community", "citedFacts"] },
    });
  });

  it("returns the kit with one draft per community, citing only brief facts", async () => {
    const llm = new FakeLlmClient().reply(
      reply({ citedFacts: ["Free 14-day trial", "Used by 10,000 teams"] }),
    );
    expect(await write(llm)).toEqual({
      ok: true,
      value: {
        listing: aListing(),
        community: [
          { channel: "hackernews", ...community.hackernews },
          { channel: "reddit", ...community.reddit },
          { channel: "indiehackers", ...community.indiehackers },
        ],
        citedFacts: ["Free 14-day trial"],
      },
    });
  });

  it("asks once for a rewrite naming every field that breaks a rule", async () => {
    const llm = new FakeLlmClient()
      .reply(
        reply({
          listing: aListing({ tagline: "a".repeat(61), features: ["Only one"] }),
          community: { ...community, hackernews: { title: "Acme", body: "Hi" } },
        }),
      )
      .reply(reply());
    const result = await write(llm);
    expect(result.ok).toBe(true);
    expect(llm.requests).toHaveLength(2);
    const [, rewrite = ""] = prompts(llm);
    expect(rewrite).toContain("Tagline is 61 characters; the limit is 60.");
    expect(rewrite).toContain("List 3 to 6 key features");
    expect(rewrite).toContain('The Show HN title must start with "Show HN:"');
  });

  it("fails when the rewrite still breaks a rule", async () => {
    const bad = reply({ listing: aListing({ tagline: "a".repeat(61) }) });
    const llm = new FakeLlmClient().reply(bad).reply(bad);
    expect(await write(llm)).toMatchObject({ ok: false, error: { code: "generation_failed" } });
    expect(llm.requests).toHaveLength(2);
  });

  it.each([
    ["text that is not JSON", "Here is your kit"],
    ["JSON with the wrong shape", JSON.stringify({ listing: {} })],
  ])("fails as generation_failed on %s", async (_, text) => {
    const result = await write(new FakeLlmClient().reply(text));
    expect(result.ok ? undefined : result.error.code).toBe("generation_failed");
  });

  it("fails as generation_failed when the answer was cut off", async () => {
    const result = await write(new FakeLlmClient().replyTruncated(reply()));
    expect(result.ok ? undefined : result.error.code).toBe("generation_failed");
  });

  it.each([
    [{ code: "rate_limited", message: "Slow", retryable: true }, "unavailable", true],
    [{ code: "refused", message: "No", retryable: false }, "generation_failed", false],
  ] as const)("maps model error %o to %s", async (error, code, retryable) => {
    expect(await write(new FakeLlmClient().fail(error))).toMatchObject({
      ok: false,
      error: { code, retryable },
    });
  });
});
