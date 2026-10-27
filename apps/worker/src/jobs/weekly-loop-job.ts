import { createLoggedJob, type Job, type JobRuntime } from "./logged-job";

export interface WeeklyLoopJobDeps {
  readonly runDue: { execute(): Promise<{ ran: number; skipped: number }> };
  readonly runtime: JobRuntime;
}

/** Runs this week's autopilot loops when due; logs counts only, never drafts or plans. */
export const createWeeklyLoopJob = ({ runDue, runtime }: WeeklyLoopJobDeps): Job =>
  createLoggedJob({
    event: "worker.weekly_loop",
    work: () => runDue.execute(),
    worthLogging: (s) => s.ran > 0,
    runtime,
  });
