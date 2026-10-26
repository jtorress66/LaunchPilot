import { numbersNotInReport, productId } from "@nuvantre/domain";
import { aBriefContent, aReportWeek, aSnapshot, aWeeklyReport } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { TemplateAnalyst } from "./template-analyst";

const analyse = (report = aWeeklyReport()) =>
  new TemplateAnalyst().analyse({ product: { name: "Acme" }, brief: aBriefContent(), report });

const firstWeek = aWeeklyReport({
  results: [
    {
      source: "ga4",
      outcome: {
        kind: "ok",
        current: aSnapshot({ source: "ga4", values: { visitors: 50 }, topQueries: [] }),
        previous: null,
      },
    },
  ],
});

describe("TemplateAnalyst", () => {
  it("leads with the largest change and suggests writing about the top query", async () => {
    expect(await analyse()).toEqual({
      ok: true,
      value: {
        summary: "Visitors rose 20% to 1,200 compared with the week before.",
        highlights: ['"/" had 700 visitors.', '"cookieless analytics" brought 40 search clicks.'],
        suggestions: ['Write a post that answers "cookieless analytics".'],
        citedFacts: [],
      },
    });
  });

  it("describes a first week without calling it growth", async () => {
    const result = await analyse(firstWeek);
    expect(result.ok && result.value.summary).toBe(
      "This is the first week with figures to compare. Visitors: 50.",
    );
    expect(result.ok && result.value.suggestions).toEqual([
      "Connect Search Console to see which searches bring visitors.",
    ]);
  });

  it("asks for a source when the report has no figures", async () => {
    const empty = aWeeklyReport({
      id: "rep_empty",
      productId: productId("prod_1"),
      week: aReportWeek(),
      results: [{ source: "ga4", outcome: { kind: "not_connected" } }],
    });
    expect(await analyse(empty)).toMatchObject({
      ok: true,
      value: { summary: "No figures this week: no source answered.", highlights: [] },
    });
  });

  const searchOnly = (current: number, previous: number, clicks = 10) =>
    aWeeklyReport({
      results: [
        {
          source: "search_console",
          outcome: {
            kind: "ok",
            current: aSnapshot({
              values: { search_clicks: clicks, search_position: current },
              topQueries: [],
            }),
            previous: aSnapshot({ values: { search_clicks: clicks, search_position: previous } }),
          },
        },
      ],
    });

  it.each([
    [8.2, 9.5, "Search position improved to 8.2 compared with the week before."],
    [9.5, 8.2, "Search position slipped to 9.5 compared with the week before."],
  ])(
    "treats a lower search position as better (%s from %s)",
    async (current, previous, summary) => {
      const result = await analyse(searchOnly(current, previous));
      expect(result.ok && result.value.summary).toBe(summary);
      expect(result.ok && result.value.suggestions).toEqual(["Publish one new article this week."]);
    },
  );

  it("says a figure held steady when it barely moved", async () => {
    const result = await analyse(searchOnly(9, 9));
    expect(result.ok && result.value.summary).toBe(
      "Search clicks held steady at 10 compared with the week before.",
    );
  });

  it("states only numbers from the report", async () => {
    for (const report of [aWeeklyReport(), firstWeek]) {
      const result = await analyse(report);
      if (!result.ok) throw new Error(result.error.message);
      const text = [result.value.summary, ...result.value.highlights, ...result.value.suggestions];
      expect(numbersNotInReport(report, text.join("\n"))).toEqual([]);
    }
  });
});
