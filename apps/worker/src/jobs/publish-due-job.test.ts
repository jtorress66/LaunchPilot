import type { PublishRunSummary } from "@nuvantre/application";
import { describe, expect, it } from "vitest";
import { createPublishDueJob } from "./publish-due-job";

const setup = (run: () => Promise<PublishRunSummary>) => {
  const lines: string[] = [];
  const job = createPublishDueJob({ publishDue: { execute: run }, log: (l) => lines.push(l) });
  return { job, lines };
};

describe("publish-due job", () => {
  it("logs one line with the run's counts", async () => {
    const { job, lines } = setup(() => Promise.resolve({ published: 2, retrying: 1, failed: 0 }));
    await job.run();
    expect(lines.map((l) => JSON.parse(l) as unknown)).toEqual([
      { event: "worker.publish_due", published: 2, retrying: 1, failed: 0 },
    ]);
  });

  it("stays quiet when nothing was due", async () => {
    const { job, lines } = setup(() => Promise.resolve({ published: 0, retrying: 0, failed: 0 }));
    await job.run();
    expect(lines).toEqual([]);
  });

  it("logs a failed run without its error message, and keeps running later", async () => {
    let calls = 0;
    const { job, lines } = setup(() => {
      calls += 1;
      return calls === 1
        ? Promise.reject(new Error("connect ECONNREFUSED postgres://app:secret@db"))
        : Promise.resolve({ published: 1, retrying: 0, failed: 0 });
    });
    await job.run();
    await job.run();
    expect(lines[0]).toBe(JSON.stringify({ event: "worker.publish_due.error", error: "Error" }));
    expect(lines.join("\n")).not.toContain("secret");
    expect(lines).toHaveLength(2);
  });

  it("skips a tick while the previous run is still going", async () => {
    let release: () => void = () => undefined;
    let calls = 0;
    const { job } = setup(() => {
      calls += 1;
      return new Promise((resolve) => {
        release = () => {
          resolve({ published: 0, retrying: 0, failed: 0 });
        };
      });
    });
    const first = job.run();
    await job.run();
    expect(calls).toBe(1);
    release();
    await first;
    void job.run();
    expect(calls).toBe(2);
  });
});
