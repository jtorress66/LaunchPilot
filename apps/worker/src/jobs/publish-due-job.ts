import type { PublishRunSummary } from "@nuvantre/application";
import { createLoggedJob, type Job, type JobRuntime } from "./logged-job";

export interface PublishDueJobDeps {
  readonly publishDue: { execute(): Promise<PublishRunSummary> };
  readonly runtime: JobRuntime;
}

export type PublishDueJob = Job;

/** Publishes what is due and logs counts only, never post text, URLs or error messages. */
export const createPublishDueJob = ({ publishDue, runtime }: PublishDueJobDeps): PublishDueJob =>
  createLoggedJob({
    event: "worker.publish_due",
    work: () => publishDue.execute(),
    worthLogging: (s) => s.published + s.retrying + s.failed + s.held > 0,
    runtime,
  });
