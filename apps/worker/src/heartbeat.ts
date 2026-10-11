import { buildHealthReport, type HealthReport } from "@launchpilot/domain";
import type { Clock } from "@launchpilot/ports";

export interface HeartbeatDeps {
  readonly clock: Clock;
  readonly version: string;
  readonly log: (line: string) => void;
}

export interface Heartbeat {
  tick(): HealthReport;
}

/** Emits one structured log line per tick so operators can see the worker is alive. */
export const createHeartbeat = ({ clock, version, log }: HeartbeatDeps): Heartbeat => ({
  tick() {
    const report = buildHealthReport({ service: "worker", version, now: clock.now() });
    log(JSON.stringify({ event: "worker.heartbeat", ...report }));
    return report;
  },
});
