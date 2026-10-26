import { createLoggedJob, type Job } from "./logged-job";

export interface WeeklyLoopJobDeps {
  readonly runDue: { execute(): Promise<{ ran: number; skipped: number }> };
  readonly log: (line: string) => void;
}

/** Runs this week's autopilot loops when due; logs counts only, never drafts or plans. */
export const createWeeklyLoopJob = ({ runDue, log }: WeeklyLoopJobDeps): Job =>
  createLoggedJob({
    event: "worker.weekly_loop",
    work: () => runDue.execute(),
    worthLogging: (s) => s.ran > 0,
    log,
  });
