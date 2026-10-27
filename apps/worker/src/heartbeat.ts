import { buildHealthReport, type HealthReport } from "@nuvantre/domain";
import type { Clock } from "@nuvantre/ports";

export interface HeartbeatDeps {
  readonly clock: Clock;
  readonly version: string;
  readonly log: (line: string) => void;
  /** Jobs whose last success each beat reports, so a stuck job stands out. */
  readonly jobs?: Readonly<Record<string, { lastSuccessAt(): Date | null }>>;
}

export interface Heartbeat {
  tick(): HealthReport;
}

/** Emits one structured log line per tick so operators can see the worker is alive. */
export const createHeartbeat = ({ clock, version, log, jobs = {} }: HeartbeatDeps): Heartbeat => ({
  tick() {
    const report = buildHealthReport({ service: "worker", version, now: clock.now() });
    const lastSuccess = Object.fromEntries(
      Object.entries(jobs).map(([name, job]) => [name, job.lastSuccessAt()?.toISOString() ?? null]),
    );
    log(JSON.stringify({ event: "worker.heartbeat", ...report, jobs: lastSuccess }));
    return report;
  },
});
