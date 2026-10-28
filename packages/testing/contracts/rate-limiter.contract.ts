import type { RateLimiter } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";
import type { FixedClock } from "../src/fakes/fixed-clock";

export interface RateLimiterHarness {
  readonly limiter: RateLimiter;
  /** The clock the limiter reads; the contract moves it. */
  readonly clock: FixedClock;
}

const rule = { limit: 3, windowSeconds: 60 };

export function describeRateLimiterContract(
  name: string,
  make: () => RateLimiterHarness | Promise<RateLimiterHarness>,
): void {
  describe(`RateLimiter contract: ${name}`, () => {
    it("allows up to the limit in a window, then refuses until the window ends", async () => {
      const { limiter, clock } = await make();
      clock.set(new Date("2026-10-28T09:00:10.000Z"));
      for (let i = 0; i < 3; i++) {
        expect(await limiter.consume("login:a", rule)).toEqual({ allowed: true });
      }
      expect(await limiter.consume("login:a", rule)).toEqual({
        allowed: false,
        retryAfterSeconds: 50,
      });
    });

    it("counts each key on its own", async () => {
      const { limiter, clock } = await make();
      clock.set(new Date("2026-10-28T09:00:10.000Z"));
      for (let i = 0; i < 3; i++) await limiter.consume("login:a", rule);
      expect(await limiter.consume("login:b", rule)).toEqual({ allowed: true });
    });

    it("starts counting again in the next window", async () => {
      const { limiter, clock } = await make();
      clock.set(new Date("2026-10-28T09:00:59.000Z"));
      for (let i = 0; i < 4; i++) await limiter.consume("login:a", rule);
      clock.set(new Date("2026-10-28T09:01:00.000Z"));
      expect(await limiter.consume("login:a", rule)).toEqual({ allowed: true });
    });

    it("never waits less than a second", async () => {
      const { limiter, clock } = await make();
      clock.set(new Date("2026-10-28T09:00:59.900Z"));
      for (let i = 0; i < 3; i++) await limiter.consume("login:a", rule);
      expect(await limiter.consume("login:a", rule)).toEqual({
        allowed: false,
        retryAfterSeconds: 1,
      });
    });
  });
}
