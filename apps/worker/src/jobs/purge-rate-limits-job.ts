import { createLoggedJob, type Job, type JobRuntime } from "./logged-job";

const KEEP_MS = 24 * 60 * 60 * 1000;

export interface PurgeRateLimitsJobDeps {
  readonly limits: { purgeBefore(before: Date): Promise<number> };
  readonly runtime: JobRuntime;
}

/** Drops rate-limit counters older than a day, so the table stays small. */
export const createPurgeRateLimitsJob = ({ limits, runtime }: PurgeRateLimitsJobDeps): Job =>
  createLoggedJob({
    event: "worker.purge_rate_limits",
    work: async () => ({
      purged: await limits.purgeBefore(new Date(runtime.clock.now().getTime() - KEEP_MS)),
    }),
    worthLogging: (s) => s.purged > 0,
    runtime,
  });
