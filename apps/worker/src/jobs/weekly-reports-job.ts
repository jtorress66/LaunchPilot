import { createLoggedJob, type Job } from "./logged-job";

export interface WeeklyReportsJobDeps {
  readonly buildDue: { execute(): Promise<{ built: number; skipped: number }> };
  readonly log: (line: string) => void;
}

/** Builds last week's reports when they are due; logs counts only, never figures or tokens. */
export const createWeeklyReportsJob = ({ buildDue, log }: WeeklyReportsJobDeps): Job =>
  createLoggedJob({
    event: "worker.weekly_reports",
    work: () => buildDue.execute(),
    worthLogging: (s) => s.built > 0,
    log,
  });
