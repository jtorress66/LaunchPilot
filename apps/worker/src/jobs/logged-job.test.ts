import { FakeErrorReporter, FixedClock, InMemoryJobLock } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { createLoggedJob } from "./logged-job";

const setUp = (work: () => Promise<{ done: number }>, held = new Set<string>()) => {
  const lines: string[] = [];
  const errors = new FakeErrorReporter();
  const clock = new FixedClock(new Date("2026-10-28T09:00:00.000Z"));
  const job = createLoggedJob({
    event: "worker.publish_due",
    work,
    worthLogging: (s) => s.done > 0,
    runtime: { log: (l) => lines.push(l), errors, lock: new InMemoryJobLock(held), clock },
  });
  return { job, lines, errors, clock };
};

describe("a logged job", () => {
  it("runs only while no other worker holds its lock, and stays quiet when skipped", async () => {
    let runs = 0;
    const held = new Set(["worker.publish_due"]);
    const { job, lines } = setUp(() => {
      runs += 1;
      return Promise.resolve({ done: 1 });
    }, held);
    await job.run();
    expect(runs).toBe(0);
    expect(lines).toEqual([]);
    held.clear();
    await job.run();
    expect(runs).toBe(1);
  });

  it("reports a failure with the job's name, and logs the error's name only", async () => {
    const failure = new Error("token=abc failed");
    const { job, lines, errors } = setUp(() => Promise.reject(failure));
    await job.run();
    expect(lines).toEqual([JSON.stringify({ event: "worker.publish_due.error", error: "Error" })]);
    expect(errors.reports).toEqual([{ error: failure, context: { job: "worker.publish_due" } }]);
  });

  it("remembers when it last succeeded, for the heartbeat", async () => {
    let fail = false;
    const { job, clock } = setUp(() =>
      fail ? Promise.reject(new Error("x")) : Promise.resolve({ done: 0 }),
    );
    expect(job.lastSuccessAt()).toBeNull();
    await job.run();
    expect(job.lastSuccessAt()).toEqual(clock.now());
    const succeeded = clock.now();
    clock.advance(60_000);
    fail = true;
    await job.run();
    expect(job.lastSuccessAt()).toEqual(succeeded);
  });
});
