import { buildHealthReport } from "@launchpilot/domain";
import type { Clock } from "@launchpilot/ports";

export interface HealthHandlerDeps {
  readonly clock: Clock;
  readonly version: string;
}

/** Adapts the domain health report to an HTTP response; no business logic lives here. */
export const createHealthHandler =
  ({ clock, version }: HealthHandlerDeps) =>
  (): Response =>
    Response.json(buildHealthReport({ service: "web", version, now: clock.now() }), {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
