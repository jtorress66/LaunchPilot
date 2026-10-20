import { describe, expect, it } from "vitest";
import { contentItemId, productId, taskId } from "../shared/ids";
import { createContentItem, transition } from "../content-item/content-item";
import { reviewOf, withAgentReview } from "./agent-review";

const now = new Date("2026-10-19T07:00:00.000Z");
const item = () => {
  const created = createContentItem({
    id: contentItemId("item_1"),
    productId: productId("prod_1"),
    taskId: taskId("task_1"),
    channel: "x",
    title: "Why cookies hurt",
    body: "No cookie banner, ever.",
    createdBy: { kind: "agent", agent: "social" },
    now,
  });
  if (!created.ok) throw new Error(created.error.message);
  return created.value;
};

describe("agent review", () => {
  it("records the reviewer's verdict, and whether the draft was rewritten for it", () => {
    const review = reviewOf(
      { decision: "needs_changes", issues: [{ severity: "suggestion", message: "Shorter" }] },
      { redrafted: true, at: now },
    );
    expect(withAgentReview(item(), review).agentReview).toEqual({
      decision: "needs_changes",
      issues: [{ severity: "suggestion", message: "Shorter" }],
      redrafted: true,
      reviewedAt: now,
    });
  });

  it("never passes a verdict that lists a blocker", () => {
    expect(
      reviewOf(
        { decision: "pass", issues: [{ severity: "blocker", message: "Invented fact" }] },
        { redrafted: false, at: now },
      ).decision,
    ).toBe("needs_changes");
  });

  it("is cleared by the founder's edit, which the reviewer has not seen", () => {
    const reviewed = withAgentReview(
      item(),
      reviewOf({ decision: "pass", issues: [] }, { redrafted: false, at: now }),
    );
    const edited = transition(reviewed, { type: "edit", body: "Edited by the founder." }, { now });
    expect(edited.ok && edited.value.agentReview).toBeNull();
  });
});
