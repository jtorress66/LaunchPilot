import type { WeeklyReport } from "@nuvantre/domain";
import { aWeeklyReport, FakeErrorReporter, FixedClock, InMemoryJobLock } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { createWeeklyReportsJob } from "./weekly-reports-job";

const runtime = (lines: string[]) => ({
  log: (l: string) => lines.push(l),
  errors: new FakeErrorReporter(),
  lock: new InMemoryJobLock(),
  clock: new FixedClock(new Date("2026-10-28T09:00:00.000Z")),
});

interface Built {
  built: number;
  skipped: number;
  reports: readonly WeeklyReport[];
}

const setup = (
  run: () => Promise<Built>,
  emailed: { sent: number; failed: number } = { sent: 0, failed: 0 },
) => {
  const lines: string[] = [];
  const emailedReports: (readonly WeeklyReport[])[] = [];
  const job = createWeeklyReportsJob({
    buildDue: { execute: run },
    emails: {
      execute: (reports) => {
        emailedReports.push(reports);
        return Promise.resolve(emailed);
      },
    },
    runtime: runtime(lines),
  });
  return { job, lines, emailedReports };
};

describe("weekly-reports job", () => {
  it("emails the reports it built and logs counts, never their contents", async () => {
    const reports = [aWeeklyReport()];
    const { job, lines, emailedReports } = setup(
      () => Promise.resolve({ built: 3, skipped: 5, reports }),
      { sent: 1, failed: 1 },
    );
    await job.run();
    expect(emailedReports).toEqual([reports]);
    expect(lines).toEqual([
      JSON.stringify({
        event: "worker.weekly_reports",
        built: 3,
        skipped: 5,
        emailed: 1,
        emailFailed: 1,
      }),
    ]);
  });

  it("stays quiet when no report was due", async () => {
    const { job, lines } = setup(() => Promise.resolve({ built: 0, skipped: 4, reports: [] }));
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
