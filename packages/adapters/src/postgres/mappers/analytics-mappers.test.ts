import { withAnalystNotes } from "@nuvantre/domain";
import { aGoogleConnection, aPlausibleConnection, aWeeklyReport } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { analyticsConnectionMapper, weeklyReportMapper } from "./analytics-mappers";

describe("analyticsConnectionMapper", () => {
  it.each([
    ["Google", aGoogleConnection()],
    ["Plausible", aPlausibleConnection()],
  ])("round-trips a %s connection", (_name, connection) => {
    expect(analyticsConnectionMapper.fromRow(analyticsConnectionMapper.toRow(connection))).toEqual(
      connection,
    );
  });

  it("keeps the secret encrypted in the row", () => {
    expect(analyticsConnectionMapper.toRow(aGoogleConnection()).encrypted_secret).toBe(
      "v1:fixture-refresh-token",
    );
  });

  it("throws on a row changed outside this code", () => {
    const row = { ...analyticsConnectionMapper.toRow(aGoogleConnection()), provider: "matomo" };
    expect(() => analyticsConnectionMapper.fromRow(row)).toThrow(/provider/);
    const broken = { ...analyticsConnectionMapper.toRow(aPlausibleConnection()), site_id: null };
    expect(() => analyticsConnectionMapper.fromRow(broken)).toThrow(/site_id/);
  });
});

describe("weeklyReportMapper", () => {
  it("round-trips a report with notes", () => {
    const report = withAnalystNotes(aWeeklyReport(), {
      summary: "Visitors rose 20%.",
      highlights: [],
      suggestions: ["Write about pricing."],
    });
    expect(weeklyReportMapper.fromRow(weeklyReportMapper.toRow(report))).toEqual(report);
  });
});
