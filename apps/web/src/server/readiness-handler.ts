import type { ReadinessProbe } from "@nuvantre/ports";

/** Readiness: 200 when every dependency answers, 503 with each reason otherwise. */
export const createReadinessHandler =
  (probes: readonly ReadinessProbe[]) => async (): Promise<Response> => {
    const checks = await Promise.all(
      probes.map(async (probe) => ({ name: probe.name, ...(await probe.check()) })),
    );
    const ready = checks.every((check) => check.ready);
    return Response.json(
      { status: ready ? "ready" : "not_ready", checks },
      { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  };
