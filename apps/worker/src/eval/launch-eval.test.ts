import type { LaunchKitDraft } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";
import { parseLaunchEvalCase, scoreKit, summariseKits, type LaunchEvalCase } from "./launch-eval";

const evalCase: LaunchEvalCase = {
  name: "acme",
  product: { name: "Acme", url: "https://acme.dev" },
  forbidden: ["SOC 2", "10,000 customers"],
  brief: {
    audience: "SaaS founders",
    problem: "Bloated dashboards",
    solution: "Five numbers a week",
    differentiators: ["No cookies"],
    tone: "Plain",
    facts: ["Free 14-day trial", "GDPR compliant"],
  },
};

const kit = (overrides: Partial<LaunchKitDraft> = {}): LaunchKitDraft => ({
  listing: {
    name: "Acme",
    tagline: "Five numbers that matter, every Monday",
    shortDescription: "Privacy-friendly analytics for SaaS founders.",
    longDescription: "Acme sends the five numbers that matter in one weekly email.",
    features: ["Weekly email", "No cookies", "Free 14-day trial"],
    categories: ["Analytics"],
    makerComment: "Hi, I built Acme because dashboards answered nothing.",
  },
  community: [
    { channel: "hackernews", title: "Show HN: Acme – five numbers a week", body: "Hi HN." },
    { channel: "reddit", title: "I built cookieless analytics", body: "Hi Reddit." },
    { channel: "indiehackers", title: "Launching Acme", body: "Hi IH." },
  ],
  citedFacts: ["Free 14-day trial"],
  ...overrides,
});

const ok = (draft: LaunchKitDraft) => ({ ok: true as const, value: draft });

describe("scoreKit", () => {
  it("passes a kit within the limits that cites only brief facts", () => {
    expect(scoreKit(evalCase, ok(kit()))).toMatchObject({
      name: "acme",
      drafted: true,
      withinLimits: true,
      citesOnlyBriefFacts: true,
      noForbiddenClaims: true,
      noHype: true,
      showHnTitle: true,
      allCommunities: true,
      passed: true,
    });
  });

  const base = kit();
  it.each([
    [
      "a tagline over 60 characters",
      kit({ listing: { ...base.listing, tagline: "a".repeat(61) } }),
      "withinLimits",
    ],
    [
      "a cited fact the brief lacks",
      kit({ citedFacts: ["Used by 10,000 teams"] }),
      "citesOnlyBriefFacts",
    ],
    [
      "a forbidden claim in a community post",
      kit({
        community: base.community.map((c) =>
          c.channel === "reddit" ? { ...c, body: "We are SOC 2 certified." } : c,
        ),
      }),
      "noForbiddenClaims",
    ],
    [
      "a hype word in the listing",
      kit({ listing: { ...base.listing, shortDescription: "The revolutionary analytics tool." } }),
      "noHype",
    ],
    [
      "a Show HN title without the prefix",
      kit({
        community: base.community.map((c) =>
          c.channel === "hackernews" ? { ...c, title: "Acme – five numbers a week" } : c,
        ),
      }),
      "showHnTitle",
    ],
    [
      "a Show HN title over 80 characters",
      kit({
        community: base.community.map((c) =>
          c.channel === "hackernews" ? { ...c, title: `Show HN: ${"a".repeat(80)}` } : c,
        ),
      }),
      "showHnTitle",
    ],
    [
      "a missing community draft",
      kit({ community: base.community.filter((c) => c.channel !== "indiehackers") }),
      "allCommunities",
    ],
  ] as const)("fails a kit with %s", (_case, draft, check) => {
    const score = scoreKit(evalCase, ok(draft));
    expect(score[check]).toBe(false);
    expect(score.passed).toBe(false);
  });

  it("fails a kit whose draft errored", () => {
    expect(
      scoreKit(evalCase, {
        ok: false,
        error: { code: "generation_failed", message: "Too long", retryable: false },
      }),
    ).toMatchObject({ drafted: false, passed: false, error: "generation_failed: Too long" });
  });
});

describe("summariseKits", () => {
  it("meets the thresholds only when every kit passes", () => {
    const pass = scoreKit(evalCase, ok(kit()));
    expect(summariseKits([pass])).toEqual({ kits: 1, passRate: 1, meetsThresholds: true });
    expect(summariseKits([pass, { ...pass, passed: false }]).meetsThresholds).toBe(false);
    expect(summariseKits([]).meetsThresholds).toBe(false);
  });
});

describe("parseLaunchEvalCase", () => {
  it("accepts a well-formed case and rejects a malformed one", () => {
    expect(parseLaunchEvalCase(JSON.parse(JSON.stringify(evalCase)) as unknown)).toEqual({
      ok: true,
      value: evalCase,
    });
    expect(parseLaunchEvalCase({ name: "x", product: { name: "X", url: "nope" } }).ok).toBe(false);
  });
});
