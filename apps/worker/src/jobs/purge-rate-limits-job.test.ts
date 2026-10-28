import { FakeErrorReporter, FixedClock, InMemoryJobLock } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { createPurgeRateLimitsJob } from "./purge-rate-limits-job";

describe("purge-rate-limits job", () => {
  const setUp = () => {
    const lines: string[] = [];
    const cutoffs: Date[] = [];
    const clock = new FixedClock(new Date("2026-10-28T09:00:00.000Z"));
    const job = createPurgeRateLimitsJob({
      limits: {
        purgeBefore: (before) => {
          cutoffs.push(before);
          return Promise.resolve(4);
        },
      },
      runtime: {
        log: (l) => lines.push(l),
        errors: new FakeErrorReporter(),
        lock: new InMemoryJobLock(),
        clock,
      },
    });
    return { job, lines, cutoffs };
  };

  it("removes counters from windows that ended over a day ago, and logs how many", async () => {
    const { job, lines, cutoffs } = setUp();
    await job.run();
    expect(cutoffs).toEqual([new Date("2026-10-27T09:00:00.000Z")]);
    expect(lines).toEqual([JSON.stringify({ event: "worker.purge_rate_limits", purged: 4 })]);
  });
});
