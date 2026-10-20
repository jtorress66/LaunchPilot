import { describe, expect, it } from "vitest";
import { lastCompleteWeek, parseWeekKey, previousWeek, weekKey } from "./report-week";

const week = (start: string, end: string) => ({ start: new Date(start), end: new Date(end) });

describe("lastCompleteWeek", () => {
  it.each([
    ["on a Monday morning", "2026-10-19T06:00:00.000Z"],
    ["on a Sunday just before midnight", "2026-10-25T23:59:59.999Z"],
    ["mid-week", "2026-10-22T12:00:00.000Z"],
  ])("is the Monday-to-Monday UTC week before this one %s", (_case, now) => {
    expect(lastCompleteWeek(new Date(now))).toEqual(
      week("2026-10-12T00:00:00.000Z", "2026-10-19T00:00:00.000Z"),
    );
  });

  it("crosses a year boundary", () => {
    expect(lastCompleteWeek(new Date("2026-01-01T10:00:00.000Z"))).toEqual(
      week("2025-12-22T00:00:00.000Z", "2025-12-29T00:00:00.000Z"),
    );
  });
});

describe("previousWeek", () => {
  it("is the seven days before", () => {
    expect(previousWeek(week("2026-10-12T00:00:00.000Z", "2026-10-19T00:00:00.000Z"))).toEqual(
      week("2026-10-05T00:00:00.000Z", "2026-10-12T00:00:00.000Z"),
    );
  });
});

describe("weekKey", () => {
  it.each([
    ["2026-10-12T00:00:00.000Z", "2026-W42"],
    ["2025-12-29T00:00:00.000Z", "2026-W01"],
    ["2026-12-28T00:00:00.000Z", "2026-W53"],
    ["2027-01-04T00:00:00.000Z", "2027-W01"],
  ])("names the ISO week starting %s as %s", (start, key) => {
    const s = new Date(start);
    expect(weekKey({ start: s, end: new Date(s.getTime() + 7 * 86_400_000) })).toBe(key);
  });
});

describe("parseWeekKey", () => {
  it.each(["2026-W42", "2026-W01", "2026-W53", "2027-W01"])("round-trips %s", (key) => {
    const parsed = parseWeekKey(key);
    expect(parsed.ok && weekKey(parsed.value)).toBe(key);
  });

  it("finds the Monday of the ISO week", () => {
    expect(parseWeekKey("2026-W01")).toEqual({
      ok: true,
      value: week("2025-12-29T00:00:00.000Z", "2026-01-05T00:00:00.000Z"),
    });
  });

  it.each(["2026-42", "2026-W00", "2026-W54", "2027-W53", "abcd-W01"])("rejects %s", (key) => {
    expect(parseWeekKey(key).ok).toBe(false);
  });
});
