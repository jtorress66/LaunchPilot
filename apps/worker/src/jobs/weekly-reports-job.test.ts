import { FakeErrorReporter, FixedClock, InMemoryJobLock } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { createWeeklyReportsJob } from "./weekly-reports-job";

const runtime = (lines: string[]) => ({
  log: (l: string) => lines.push(l),
  errors: new FakeErrorReporter(),
  lock: new InMemoryJobLock(),
  clock: new FixedClock(new Date("2026-10-28T09:00:00.000Z")),
});

const setup = (run: () => Promise<{ built: number; skipped: number }>) => {
  const lines: string[] = [];
  const job = createWeeklyReportsJob({ buildDue: { execute: run }, runtime: runtime(lines) });
  return { job, lines };
};

describe("weekly-reports job", () => {
  it("logs how many reports it built, never their contents", async () => {
    const { job, lines } = setup(() => Promise.resolve({ built: 3, skipped: 5 }));
    await job.run();
    expect(lines).toEqual([
      JSON.stringify({ event: "worker.weekly_reports", built: 3, skipped: 5 }),
    ]);
  });

  it("stays quiet when no report was due", async () => {
    const { job, lines } = setup(() => Promise.resolve({ built: 0, skipped: 4 }));
    await job.run();
    expect(lines).toEqual([]);
  });

  it("logs a failed run by error name only", async () => {
    const { job, lines } = setup(() => Promise.reject(new Error("refresh_token=1//secret failed")));
    await job.run();
    expect(lines).toEqual([
      JSON.stringify({ event: "worker.weekly_reports.error", error: "Error" }),
    ]);
  });
});
