import { describe, expect, it } from "vitest";
import type { Clock } from "@nuvantre/ports";

/**
 * Shared contract every Clock implementation must pass (Liskov substitution).
 * Run it from the implementation's own test file:
 *   describeClockContract("SystemClock", () => new SystemClock());
 */
export function describeClockContract(name: string, makeClock: () => Clock): void {
  describe(`Clock contract: ${name}`, () => {
    it("returns a valid Date", () => {
      const now = makeClock().now();
      expect(now).toBeInstanceOf(Date);
      expect(Number.isNaN(now.getTime())).toBe(false);
    });

    it("never goes backwards between successive calls", () => {
      const clock = makeClock();
      const first = clock.now().getTime();
      const second = clock.now().getTime();
      expect(second).toBeGreaterThanOrEqual(first);
    });

    it("returns a fresh Date instance on every call", () => {
      const clock = makeClock();
      expect(clock.now()).not.toBe(clock.now());
    });
  });
}
