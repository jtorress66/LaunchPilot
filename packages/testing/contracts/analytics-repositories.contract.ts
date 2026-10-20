import { productId, withAnalystNotes, type ReportWeek } from "@launchpilot/domain";
import type { AnalyticsConnectionRepository, WeeklyReportRepository } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";
import {
  aGoogleConnection,
  aPlausibleConnection,
  aReportWeek,
  aWeeklyReport,
} from "../src/fixtures/analytics";

type Make<R> = () => R | Promise<R>;

export function describeAnalyticsConnectionRepositoryContract(
  name: string,
  make: Make<AnalyticsConnectionRepository>,
): void {
  describe(`AnalyticsConnectionRepository contract: ${name}`, () => {
    it("finds each provider's connection, typed by provider", async () => {
      const repo = await make();
      const google = aGoogleConnection();
      const plausible = aPlausibleConnection();
      await repo.save(google);
      await repo.save(plausible);
      expect(await repo.find(google.productId, "google")).toEqual(google);
      expect(await repo.find(google.productId, "plausible")).toEqual(plausible);
      expect(await repo.find(productId("prod_2"), "google")).toBeUndefined();
    });

    it("replaces the connection for the same product and provider", async () => {
      const repo = await make();
      await repo.save(aGoogleConnection());
      const changed = aGoogleConnection({ id: "an_other", searchConsoleSite: null });
      await repo.save(changed);
      expect(await repo.listByProduct(changed.productId)).toEqual([changed]);
    });

    it("lists a product's connections by provider and the products that have any", async () => {
      const repo = await make();
      const plausible = aPlausibleConnection({ productId: productId("prod_2") });
      const google = aGoogleConnection({ productId: productId("prod_2") });
      await repo.save(plausible);
      await repo.save(google);
      await repo.save(aGoogleConnection({ id: "an_g1" }));
      expect(await repo.listByProduct(productId("prod_2"))).toEqual([google, plausible]);
      expect(await repo.listConnectedProductIds()).toEqual(["prod_1", "prod_2"]);
    });

    it("deletes one provider's connection and leaves the others", async () => {
      const repo = await make();
      await repo.save(aGoogleConnection());
      await repo.save(aPlausibleConnection());
      await repo.delete(productId("prod_1"), "google");
      expect(await repo.find(productId("prod_1"), "google")).toBeUndefined();
      expect(await repo.find(productId("prod_1"), "plausible")).toEqual(aPlausibleConnection());
    });
  });
}

const weekBefore = (week: ReportWeek): ReportWeek => ({
  start: new Date(week.start.getTime() - 7 * 86_400_000),
  end: week.start,
});

export function describeWeeklyReportRepositoryContract(
  name: string,
  make: Make<WeeklyReportRepository>,
): void {
  describe(`WeeklyReportRepository contract: ${name}`, () => {
    it("round-trips a report with its notes, dates and rows", async () => {
      const repo = await make();
      const report = withAnalystNotes(aWeeklyReport(), {
        summary: "Clicks rose 20%.",
        highlights: ["Visitors 1,200"],
        suggestions: ["Write about pricing"],
      });
      await repo.save(report);
      expect(await repo.findByProductAndWeek(report.productId, report.weekKey)).toEqual(report);
      expect(await repo.findByProductAndWeek(report.productId, "2020-W01")).toBeUndefined();
    });

    it("keeps one report per product and week, replacing it on save", async () => {
      const repo = await make();
      await repo.save(aWeeklyReport());
      const rebuilt = aWeeklyReport({ id: "rep_2", now: new Date("2026-01-06T09:00:00.000Z") });
      await repo.save(rebuilt);
      expect(await repo.listByProduct(rebuilt.productId)).toEqual([rebuilt]);
    });

    it("lists a product's reports newest week first", async () => {
      const repo = await make();
      const latest = aWeeklyReport();
      const older = aWeeklyReport({ id: "rep_old", week: weekBefore(aReportWeek()) });
      const other = aWeeklyReport({ id: "rep_other", productId: productId("prod_2") });
      await repo.save(older);
      await repo.save(latest);
      await repo.save(other);
      expect((await repo.listByProduct(latest.productId)).map((r) => r.id)).toEqual([
        "rep_1",
        "rep_old",
      ]);
    });
  });
}
