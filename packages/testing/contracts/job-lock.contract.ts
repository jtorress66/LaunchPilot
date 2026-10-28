import type { JobLock } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";

/** Two locks that compete for the same jobs, as two worker processes would. */
export interface JobLockHarness {
  readonly first: JobLock;
  readonly second: JobLock;
}

const deferred = () => {
  let release: (() => void) | undefined;
  const done = new Promise<void>((resolve) => (release = resolve));
  return {
    done,
    release: () => {
      release?.();
    },
  };
};

export function describeJobLockContract(
  name: string,
  make: () => JobLockHarness | Promise<JobLockHarness>,
): void {
  describe(`JobLock contract: ${name}`, () => {
    it("runs the work and says so", async () => {
      const { first } = await make();
      let ran = false;
      expect(
        await first.runExclusive("publish-due", () => {
          ran = true;
          return Promise.resolve();
        }),
      ).toBe("ran");
      expect(ran).toBe(true);
    });

    it("skips the same job while another holder runs it, but not other jobs", async () => {
      const { first, second } = await make();
      const gate = deferred();
      const running = first.runExclusive("publish-due", () => gate.done);
      // Give the first holder time to take the lock.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(await second.runExclusive("publish-due", () => Promise.resolve())).toBe("skipped");
      expect(await second.runExclusive("weekly-reports", () => Promise.resolve())).toBe("ran");
      gate.release();
      expect(await running).toBe("ran");
      expect(await second.runExclusive("publish-due", () => Promise.resolve())).toBe("ran");
    });

    it("releases the lock when the work fails, and passes the failure on", async () => {
      const { first, second } = await make();
      await expect(
        first.runExclusive("publish-due", () => Promise.reject(new Error("boom"))),
      ).rejects.toThrow("boom");
      expect(await second.runExclusive("publish-due", () => Promise.resolve())).toBe("ran");
    });
  });
}
