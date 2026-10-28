import type { Clock, ErrorReporter, JobLock } from "@nuvantre/ports";

export interface Job {
  run(): Promise<void>;
  /** When the job last finished without an error; null until it has. */
  lastSuccessAt(): Date | null;
}

/** What every scheduled job runs with: one lock per job across workers, and error reporting. */
export interface JobRuntime {
  readonly log: (line: string) => void;
  readonly errors: ErrorReporter;
  readonly lock: JobLock;
  readonly clock: Clock;
}

/**
 * One scheduler tick of a background job: runs `work` under the job's lock, so two workers never
 * run it at once; logs its counts as one JSON line when `worthLogging`; on failure logs the
 * error's name only (messages can carry secrets) and reports the error, scrubbed, with the job's
 * name. A tick that arrives while the previous run is still going is skipped.
 */
export const createLoggedJob = <Summary extends object>(options: {
  readonly event: string;
  readonly work: () => Promise<Summary>;
  readonly worthLogging: (summary: Summary) => boolean;
  readonly runtime: JobRuntime;
}): Job => {
  const { log, errors, lock, clock } = options.runtime;
  let running = false;
  let lastSuccess: Date | null = null;
  return {
    async run() {
      if (running) return;
      running = true;
      try {
        await lock.runExclusive(options.event, async () => {
          const summary = await options.work();
          lastSuccess = clock.now();
          if (options.worthLogging(summary)) {
            log(JSON.stringify({ event: options.event, ...summary }));
          }
        });
      } catch (error) {
        const name = error instanceof Error ? error.name : "UnknownError";
        log(JSON.stringify({ event: `${options.event}.error`, error: name }));
        errors.report(error, { job: options.event });
      } finally {
        running = false;
      }
    },
    lastSuccessAt: () => lastSuccess,
  };
};
