import { describe, expect, it } from "vitest";
import type { Actor } from "../shared/actor";
import { briefId, productId, userId } from "../shared/ids";
import { approveBrief, createBrief, reviseBrief, type BriefContent } from "./brief";

const t0 = new Date("2026-01-01T00:00:00.000Z");
const t1 = new Date("2026-01-02T00:00:00.000Z");
const founder: Actor = { kind: "founder", userId: userId("user_1") };
const agent: Actor = { kind: "agent", agent: "strategist" };

const content: BriefContent = {
  audience: "Solo SaaS founders",
  problem: "Marketing takes time away from building",
  solution: "An AI marketing team with founder approval",
  differentiators: ["Approval before publishing"],
  tone: "Friendly and direct",
  facts: ["Free 14-day trial", "Integrates with Search Console"],
};

const draft = () => {
  const result = createBrief({
    id: briefId("brief_1"),
    productId: productId("prod_1"),
    content,
    now: t0,
  });
  if (!result.ok) throw new Error("setup failed");
  return result.value;
};

describe("brief", () => {
  it("is created as draft version 1", () => {
    expect(draft()).toMatchObject({ status: "draft", version: 1, approval: null, updatedAt: t0 });
  });

  it("rejects missing core fields", () => {
    const result = createBrief({
      id: briefId("brief_1"),
      productId: productId("prod_1"),
      content: { ...content, problem: " " },
      now: t0,
    });
    expect(result.ok ? undefined : result.error.code).toBe("invalid_text");
  });

  it("rejects blank facts so agents never cite an empty claim", () => {
    const result = createBrief({
      id: briefId("brief_1"),
      productId: productId("prod_1"),
      content: { ...content, facts: ["Real fact", "  "] },
      now: t0,
    });
    expect(result.ok ? undefined : result.error.code).toBe("invalid_text");
  });

  it("can be approved by the founder, recording who and when", () => {
    expect(approveBrief(draft(), founder, { now: t1 })).toEqual({
      ok: true,
      value: { ...draft(), status: "approved", approval: { by: "user_1", at: t1 }, updatedAt: t1 },
    });
  });

  it("cannot be approved by an agent", () => {
    const result = approveBrief(draft(), agent, { now: t1 });
    expect(result.ok ? undefined : result.error.code).toBe("approval_requires_founder");
  });

  it("cannot be approved without any product facts", () => {
    const noFacts = createBrief({
      id: briefId("brief_1"),
      productId: productId("prod_1"),
      content: { ...content, facts: [] },
      now: t0,
    });
    if (!noFacts.ok) throw new Error("setup failed");
    const result = approveBrief(noFacts.value, founder, { now: t1 });
    expect(result.ok ? undefined : result.error.code).toBe("brief_has_no_facts");
  });

  it("cannot be approved twice", () => {
    const approved = approveBrief(draft(), founder, { now: t1 });
    if (!approved.ok) throw new Error("setup failed");
    const result = approveBrief(approved.value, founder, { now: t1 });
    expect(result.ok ? undefined : result.error.code).toBe("invalid_transition");
  });

  it("revising bumps the version and returns an approved brief to draft", () => {
    const approved = approveBrief(draft(), founder, { now: t1 });
    if (!approved.ok) throw new Error("setup failed");
    const revised = reviseBrief(approved.value, { ...content, tone: "Playful" }, { now: t1 });
    expect(revised).toMatchObject({
      ok: true,
      value: { status: "draft", version: 2, approval: null, content: { tone: "Playful" } },
    });
  });

  it("rejects an invalid revision", () => {
    const result = reviseBrief(draft(), { ...content, audience: "" }, { now: t1 });
    expect(result.ok).toBe(false);
  });
});
