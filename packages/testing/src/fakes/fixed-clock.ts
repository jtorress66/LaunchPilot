import type { Clock } from "@nuvantre/ports";

/** Deterministic Clock for tests: time only moves when the test moves it. */
export class FixedClock implements Clock {
  private current: number;

  constructor(start: Date) {
    this.current = start.getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  set(time: Date): void {
    this.current = time.getTime();
  }

  advance(milliseconds: number): void {
    if (milliseconds < 0) throw new RangeError("FixedClock cannot move backwards");
    this.current += milliseconds;
  }
}
