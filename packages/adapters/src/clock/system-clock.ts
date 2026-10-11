import type { Clock } from "@launchpilot/ports";

/** Production Clock backed by the host's system time. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
