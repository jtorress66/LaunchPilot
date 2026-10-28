import { createLoggedJob, type Job, type JobRuntime } from "./logged-job";

export interface WeeklyReportsJobDeps {
  readonly buildDue: { execute(): Promise<{ built: number; skipped: number }> };
  readonly runtime: JobRuntime;
}

/** Builds last week's reports when they are due; logs counts only, never figures or tokens. */
export const createWeeklyReportsJob = ({ buildDue, runtime }: WeeklyReportsJobDeps): Job =>
  createLoggedJob({
    event: "worker.weekly_reports",
    work: () => buildDue.execute(),
    worthLogging: (s) => s.built > 0,
    runtime,
  });
