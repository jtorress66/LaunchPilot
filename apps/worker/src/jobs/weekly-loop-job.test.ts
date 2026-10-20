import { describe, expect, it } from "vitest";
import { createWeeklyLoopJob } from "./weekly-loop-job";

const setup = (run: () => Promise<{ ran: number; skipped: number }>) => {
  const lines: string[] = [];
  const job = createWeeklyLoopJob({ runDue: { execute: run }, log: (l) => lines.push(l) });
  return { job, lines };
};

describe("weekly-loop job", () => {
  it("logs how many products' weeks it ran, never what was drafted", async () => {
    const { job, lines } = setup(() => Promise.resolve({ ran: 2, skipped: 3 }));
    await job.run();
    expect(lines).toEqual([JSON.stringify({ event: "worker.weekly_loop", ran: 2, skipped: 3 })]);
  });

  it("stays quiet when no week was due", async () => {
    const { job, lines } = setup(() => Promise.resolve({ ran: 0, skipped: 3 }));
    await job.run();
    expect(lines).toEqual([]);
  });

  it("logs a failed run by error name only", async () => {
    const { job, lines } = setup(() => Promise.reject(new TypeError("token=secret")));
    await job.run();
    expect(lines).toEqual([
      JSON.stringify({ event: "worker.weekly_loop.error", error: "TypeError" }),
    ]);
  });
});
