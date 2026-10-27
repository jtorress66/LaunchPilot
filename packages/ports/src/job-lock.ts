/** Runs a job only if no other worker is running the same one right now. */
export interface JobLock {
  runExclusive(name: string, work: () => Promise<void>): Promise<"ran" | "skipped">;
}
