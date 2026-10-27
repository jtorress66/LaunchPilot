import { FakeErrorReporter, FixedClock, InMemoryJobLock } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { createWeeklyLoopJob } from "./weekly-loop-job";

const runtime = (lines: string[]) => ({
  log: (l: string) => lines.push(l),
  errors: new FakeErrorReporter(),
  lock: new InMemoryJobLock(),
  clock: new FixedClock(new Date("2026-10-28T09:00:00.000Z")),
});

const setup = (run: () => Promise<{ ran: number; skipped: number }>) => {
  const lines: string[] = [];
  const job = createWeeklyLoopJob({ runDue: { execute: run }, runtime: runtime(lines) });
  return { job, lines };
};

describe("weekly-loop job", () => {
  it("logs how many products' weeks it ran, never what was drafted", async () => {
    const { job, lines } = setup(() => Promise.resolve({ ran: 2, skipped: 3 }));
    await job.run();
    expect(lines).toEqual([JSON.stringify({ event: "worker.weekly_loop", ran: 2, skipped: 3 })]);
  });

  it("stays quiet when no week was due", async () => {
    const { job, lines } = setup(() => Promise.resolve({ ran: 0, skipped: 3 }));
    await job.run();
    expect(lines).toEqual([]);
  });

  it("logs a failed run by error name only", async () => {
    const { job, lines } = setup(() => Promise.reject(new TypeError("token=secret")));
    await job.run();
    expect(lines).toEqual([
      JSON.stringify({ event: "worker.weekly_loop.error", error: "TypeError" }),
    ]);
  });
});
