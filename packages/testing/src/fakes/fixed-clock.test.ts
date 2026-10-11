import { describe, expect, it } from "vitest";
import { FixedClock } from "./fixed-clock";

describe("FixedClock", () => {
  const start = new Date("2026-03-01T00:00:00.000Z");

  it("returns the time it was created with", () => {
    expect(new FixedClock(start).now()).toEqual(start);
  });

  it("advances by the given milliseconds", () => {
    const clock = new FixedClock(start);
    clock.advance(1_500);
    expect(clock.now().toISOString()).toBe("2026-03-01T00:00:01.500Z");
  });

  it("can be set to a new time", () => {
    const clock = new FixedClock(start);
    const later = new Date("2026-04-01T12:00:00.000Z");
    clock.set(later);
    expect(clock.now()).toEqual(later);
  });

  it("returns a copy so callers cannot mutate its time", () => {
    const clock = new FixedClock(start);
    clock.now().setFullYear(1999);
    expect(clock.now()).toEqual(start);
  });

  it("is not affected when the caller mutates the date it was given", () => {
    const input = new Date(start);
    const clock = new FixedClock(input);
    input.setFullYear(1999);
    expect(clock.now()).toEqual(start);
  });

  it("refuses to move backwards so it honours the Clock contract", () => {
    const clock = new FixedClock(start);
    expect(() => {
      clock.advance(-1);
    }).toThrow(RangeError);
  });
});
