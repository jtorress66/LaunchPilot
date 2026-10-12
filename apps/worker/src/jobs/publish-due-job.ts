import type { PublishRunSummary } from "@launchpilot/application";

export interface PublishDueJobDeps {
  readonly publishDue: { execute(): Promise<PublishRunSummary> };
  readonly log: (line: string) => void;
}

export interface PublishDueJob {
  run(): Promise<void>;
}

/**
 * One scheduler tick: publishes what is due and logs counts only, never post text, URLs or
 * errors' messages (which can carry connection strings). Overlapping ticks are skipped.
 */
export const createPublishDueJob = ({ publishDue, log }: PublishDueJobDeps): PublishDueJob => {
  let running = false;
  return {
    async run() {
      if (running) return;
      running = true;
      try {
        const summary = await publishDue.execute();
        if (summary.published + summary.retrying + summary.failed > 0) {
          log(JSON.stringify({ event: "worker.publish_due", ...summary }));
        }
      } catch (error) {
        const name = error instanceof Error ? error.name : "UnknownError";
        log(JSON.stringify({ event: "worker.publish_due.error", error: name }));
      } finally {
        running = false;
      }
    },
  };
};
