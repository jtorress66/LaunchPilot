export interface Job {
  run(): Promise<void>;
}

/**
 * One scheduler tick of a background job: runs `work`, logs its counts as one JSON line when
 * `worthLogging`, and on failure logs the error's name only (messages can carry secrets or
 * connection strings). A tick that arrives while the previous run is still going is skipped.
 */
export const createLoggedJob = <Summary extends object>(options: {
  readonly event: string;
  readonly work: () => Promise<Summary>;
  readonly worthLogging: (summary: Summary) => boolean;
  readonly log: (line: string) => void;
}): Job => {
  let running = false;
  return {
    async run() {
      if (running) return;
      running = true;
      try {
        const summary = await options.work();
        if (options.worthLogging(summary)) {
          options.log(JSON.stringify({ event: options.event, ...summary }));
        }
      } catch (error) {
        const name = error instanceof Error ? error.name : "UnknownError";
        options.log(JSON.stringify({ event: `${options.event}.error`, error: name }));
      } finally {
        running = false;
      }
    },
  };
};
