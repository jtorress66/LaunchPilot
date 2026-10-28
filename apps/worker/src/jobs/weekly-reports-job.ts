import type { WeeklyReport } from "@nuvantre/domain";
import { createLoggedJob, type Job, type JobRuntime } from "./logged-job";

export interface WeeklyReportsJobDeps {
  readonly buildDue: {
    execute(): Promise<{ built: number; skipped: number; reports: readonly WeeklyReport[] }>;
  };
  readonly emails: {
    execute(reports: readonly WeeklyReport[]): Promise<{ sent: number; failed: number }>;
  };
  readonly runtime: JobRuntime;
}

/**
 * Builds last week's reports when they are due, then emails each to its product's weekly list.
 * Logs counts only, never figures, addresses or tokens.
 */
export const createWeeklyReportsJob = ({ buildDue, emails, runtime }: WeeklyReportsJobDeps): Job =>
  createLoggedJob({
    event: "worker.weekly_reports",
    work: async () => {
      const { built, skipped, reports } = await buildDue.execute();
      if (reports.length === 0) return { built, skipped };
      const emailed = await emails.execute(reports);
      return { built, skipped, emailed: emailed.sent, emailFailed: emailed.failed };
    },
    worthLogging: (s) => s.built > 0,
    runtime,
  });
