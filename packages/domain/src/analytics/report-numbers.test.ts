import { describe, expect, it } from "vitest";
import { productId, weeklyReportId } from "../shared/ids";
import { formatChange, formatMetricValue, numbersNotInReport } from "./report-numbers";
import type { WeeklyReport } from "./weekly-report";

const report: WeeklyReport = {
  id: weeklyReportId("rep_1"),
  productId: productId("prod_1"),
  week: {
    start: new Date("2026-10-12T00:00:00.000Z"),
    end: new Date("2026-10-19T00:00:00.000Z"),
  },
  weekKey: "2026-W42",
  metrics: [
    { name: "visitors", value: 1234, previous: 1000, change: 0.234, source: "ga4" },
    { name: "search_ctr", value: 0.0345, previous: 0.03, change: 0.15, source: "search_console" },
    {
      name: "search_position",
      value: 14.26,
      previous: 15,
      change: -0.0493,
      source: "search_console",
    },
  ],
  topPages: [{ url: "/blog/2026-guide", visitors: 310 }],
  topQueries: [{ query: "gdpr analytics", clicks: 42, impressions: 900, position: 3.14 }],
  sources: [],
  notes: null,
  notesError: null,
  builtAt: new Date("2026-10-19T06:00:00.000Z"),
};

describe("formatMetricValue", () => {
  it.each([
    ["visitors", 1234, "1,234"],
    ["search_ctr", 0.0345, "3.5%"],
    ["search_position", 14.26, "14.3"],
  ] as const)("shows %s %s as %s", (name, value, shown) => {
    expect(formatMetricValue(name, value)).toBe(shown);
  });
});

describe("formatChange", () => {
  it.each([
    [0.234, "+23%"],
    [-0.0493, "−5%"],
    [0, "0%"],
    [null, "new"],
  ])("shows %s as %s", (change, shown) => {
    expect(formatChange(change)).toBe(shown);
  });
});

describe("numbersNotInReport", () => {
  it("accepts figures the report shows, as shown or rounded, with or without separators", () => {
    const text =
      "Visitors rose 23% to 1,234 (from 1000, up 234). CTR was 3.5%, about 3%, from 3%. " +
      "Position improved to 14.3 from 15.0. /blog/2026-guide had 310 visitors; " +
      '"gdpr analytics" brought 42 clicks from 900 impressions at position 3.1.';
    expect(numbersNotInReport(report, text)).toEqual([]);
  });

  it("accepts the week's dates and small counts", () => {
    expect(numbersNotInReport(report, "In the week of 12 to 18 October 2026, 3 pages")).toEqual([]);
  });

  it("lists every number the report does not contain", () => {
    expect(numbersNotInReport(report, "Signups hit 57, a 40% jump; 1,234 visitors")).toEqual([
      "57",
      "40",
    ]);
  });
});
