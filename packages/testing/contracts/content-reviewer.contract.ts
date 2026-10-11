import type { ContentReviewer, ReviewRequest } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";
import { aBriefContent } from "../src/fixtures/entities";

export interface ContentReviewerHarness {
  readonly reviewer: ContentReviewer;
  givenFailure(): void | Promise<void>;
}

const request: ReviewRequest = {
  brief: aBriefContent(),
  channel: "linkedin",
  title: "Why we built Acme",
  body: "Acme helps solo founders market their SaaS.",
};

export function describeContentReviewerContract(
  name: string,
  make: () => ContentReviewerHarness | Promise<ContentReviewerHarness>,
): void {
  describe(`ContentReviewer contract: ${name}`, () => {
    it("returns a verdict that asks for changes whenever it lists a blocker", async () => {
      const { reviewer } = await make();
      const result = await reviewer.review(request);
      if (!result.ok) throw new Error(result.error.message);
      expect(["pass", "needs_changes"]).toContain(result.value.decision);
      const hasBlocker = result.value.issues.some((issue) => issue.severity === "blocker");
      expect(hasBlocker && result.value.decision === "pass").toBe(false);
    });

    it("reports a failure as a ReviewError result instead of throwing", async () => {
      const harness = await make();
      await harness.givenFailure();
      expect((await harness.reviewer.review(request)).ok).toBe(false);
    });
  });
}
