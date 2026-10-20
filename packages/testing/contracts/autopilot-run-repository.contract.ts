import { autopilotRunId, campaignId, productId, type AutopilotRun } from "@launchpilot/domain";
import type { AutopilotRunRepository } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";

const week = (start: string) => {
  const s = new Date(start);
  return { start: s, end: new Date(s.getTime() + 7 * 86_400_000) };
};

export const anAutopilotRun = (overrides: Partial<AutopilotRun> = {}): AutopilotRun => ({
  id: autopilotRunId("run_1"),
  productId: productId("prod_1"),
  week: week("2026-10-19T00:00:00.000Z"),
  outcome: {
    kind: "completed",
    campaignId: campaignId("camp_1"),
    summary: { planned: 5, dropped: 1, drafted: 5, redrafted: 1, failed: 0, stoppedAtLimit: false },
  },
  ranAt: new Date("2026-10-19T07:01:00.000Z"),
  ...overrides,
});

export function describeAutopilotRunRepositoryContract(
  name: string,
  make: () => AutopilotRunRepository | Promise<AutopilotRunRepository>,
): void {
  describe(`AutopilotRunRepository contract: ${name}`, () => {
    it("finds a product's run by week, with its outcome", async () => {
      const repo = await make();
      const run = anAutopilotRun();
      const skipped = anAutopilotRun({
        id: autopilotRunId("run_2"),
        productId: productId("prod_2"),
        outcome: { kind: "skipped", reason: "Approve the Product Brief first" },
      });
      await repo.save(run);
      await repo.save(skipped);
      expect(await repo.findByProductAndWeek(run.productId, run.week.start)).toEqual(run);
      expect(await repo.findByProductAndWeek(skipped.productId, run.week.start)).toEqual(skipped);
      expect(
        await repo.findByProductAndWeek(run.productId, new Date("2026-10-12T00:00:00.000Z")),
      ).toBeUndefined();
    });

    it("keeps one run per product and week, replacing it on save", async () => {
      const repo = await make();
      await repo.save(anAutopilotRun({ outcome: { kind: "failed", reason: "Busy" } }));
      const rerun = anAutopilotRun({ id: autopilotRunId("run_again") });
      await repo.save(rerun);
      expect(await repo.findByProductAndWeek(rerun.productId, rerun.week.start)).toEqual(rerun);
    });

    it("returns a product's latest week", async () => {
      const repo = await make();
      const older = anAutopilotRun({
        id: autopilotRunId("run_old"),
        week: week("2026-10-12T00:00:00.000Z"),
      });
      const latest = anAutopilotRun();
      await repo.save(latest);
      await repo.save(older);
      expect(await repo.latestForProduct(productId("prod_1"))).toEqual(latest);
      expect(await repo.latestForProduct(productId("prod_9"))).toBeUndefined();
    });
  });
}
