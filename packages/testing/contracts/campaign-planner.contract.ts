import { channels, validateWeekPlan } from "@nuvantre/domain";
import type { CampaignPlanner, PlanRequest } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";
import { aWeeklyReport } from "../src/fixtures/analytics";
import { aBriefContent } from "../src/fixtures/entities";
import { aPlanRequest } from "../src/fixtures/orchestration";

export interface CampaignPlannerHarness {
  readonly planner: CampaignPlanner;
  givenFailure(): void | Promise<void>;
}

export function describeCampaignPlannerContract(
  name: string,
  make: () => CampaignPlannerHarness | Promise<CampaignPlannerHarness>,
): void {
  describe(`CampaignPlanner contract: ${name}`, () => {
    const request: PlanRequest = aPlanRequest({
      lastWeek: aWeeklyReport(),
      brief: aBriefContent(),
    });

    it("returns a named plan whose tasks target known channels", async () => {
      const { planner } = await make();
      const result = await planner.plan(request);
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.name.trim()).not.toBe("");
      expect(result.value.goal.trim()).not.toBe("");
      expect(result.value.tasks.length).toBeGreaterThan(0);
      for (const task of result.value.tasks) {
        expect(channels).toContain(task.channel);
        expect(task.title.trim()).not.toBe("");
        expect(task.rationale.trim()).not.toBe("");
      }
    });

    it("plans only from the offered keywords and angles, within the allowance", async () => {
      const { planner } = await make();
      const result = await planner.plan(request);
      if (!result.ok) throw new Error(result.error.message);
      const checked = validateWeekPlan(result.value.tasks, request);
      expect(checked.dropped.filter((d) => d.reason !== "over_allowance")).toEqual([]);
      expect(checked.accepted.length).toBeLessThanOrEqual(request.allowance);
    });

    it("plans without a report in its first week", async () => {
      const { planner } = await make();
      expect((await planner.plan({ ...request, lastWeek: null })).ok).toBe(true);
    });

    it("reports a failure as a PlanError result instead of throwing", async () => {
      const harness = await make();
      await harness.givenFailure();
      expect((await harness.planner.plan(request)).ok).toBe(false);
    });
  });
}
