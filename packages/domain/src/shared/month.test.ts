import { describe, expect, it } from "vitest";
import { startOfUtcMonth } from "./month";

describe("startOfUtcMonth", () => {
  it("returns midnight UTC on the first day of the month", () => {
    expect(startOfUtcMonth(new Date("2026-10-12T15:30:00.000Z"))).toEqual(
      new Date("2026-10-01T00:00:00.000Z"),
    );
  });

  it("handles the first instant of a month and the end of a year", () => {
    expect(startOfUtcMonth(new Date("2026-01-01T00:00:00.000Z"))).toEqual(
      new Date("2026-01-01T00:00:00.000Z"),
    );
    expect(startOfUtcMonth(new Date("2026-12-31T23:59:59.999Z"))).toEqual(
      new Date("2026-12-01T00:00:00.000Z"),
    );
  });
});
