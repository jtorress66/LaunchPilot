import { numbersNotInReport } from "@launchpilot/domain";
import type { WeeklyReportAnalyst } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";
import { aWeeklyReport } from "../src/fixtures/analytics";
import { aBriefContent } from "../src/fixtures/entities";

export function describeWeeklyReportAnalystContract(
  name: string,
  make: () => WeeklyReportAnalyst | Promise<WeeklyReportAnalyst>,
): void {
  describe(`WeeklyReportAnalyst contract: ${name}`, () => {
    const report = aWeeklyReport();
    const brief = aBriefContent();

    it("summarises the week with 1 to 3 suggestions, stating only the report's numbers", async () => {
      const analyst = await make();
      const result = await analyst.analyse({ product: { name: "Acme" }, brief, report });
      if (!result.ok) throw new Error(result.error.message);
      const { summary, highlights, suggestions } = result.value;
      expect(summary.trim()).not.toBe("");
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions.length).toBeLessThanOrEqual(3);
      const text = [summary, ...highlights, ...suggestions].join("\n");
      expect(numbersNotInReport(report, text)).toEqual([]);
    });

    it("cites only facts from the brief, and none without one", async () => {
      const analyst = await make();
      const withBrief = await analyst.analyse({ product: { name: "Acme" }, brief, report });
      if (!withBrief.ok) throw new Error(withBrief.error.message);
      for (const fact of withBrief.value.citedFacts) expect(brief.facts).toContain(fact);
      const without = await analyst.analyse({ product: { name: "Acme" }, brief: null, report });
      if (!without.ok) throw new Error(without.error.message);
      expect(without.value.citedFacts).toEqual([]);
    });
  });
}
