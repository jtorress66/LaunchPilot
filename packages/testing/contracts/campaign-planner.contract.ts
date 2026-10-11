import { channels } from "@launchpilot/domain";
import type { CampaignPlanner, PlanRequest } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";
import { aBriefContent } from "../src/fixtures/entities";

export interface CampaignPlannerHarness {
  readonly planner: CampaignPlanner;
  givenFailure(): void | Promise<void>;
}

const request: PlanRequest = {
  brief: aBriefContent(),
  weekStarting: new Date("2026-01-05T00:00:00.000Z"),
};

export function describeCampaignPlannerContract(
  name: string,
  make: () => CampaignPlannerHarness | Promise<CampaignPlannerHarness>,
): void {
  describe(`CampaignPlanner contract: ${name}`, () => {
    it("returns a named plan whose tasks target known channels", async () => {
      const { planner } = await make();
      const result = await planner.plan(request);
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.name.trim()).not.toBe("");
      expect(result.value.goal.trim()).not.toBe("");
      for (const task of result.value.tasks) {
        expect(channels).toContain(task.channel);
        expect(task.title.trim()).not.toBe("");
      }
    });

    it("reports a failure as a PlanError result instead of throwing", async () => {
      const harness = await make();
      await harness.givenFailure();
      expect((await harness.planner.plan(request)).ok).toBe(false);
    });
  });
}
