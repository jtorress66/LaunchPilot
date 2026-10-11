import { SystemClock } from "@launchpilot/adapters";
import type { HealthHandlerDeps } from "./server/health-handler";

/** Composition root: the only place in the web app where concrete adapters are created. */
export const container = {
  clock: new SystemClock(),
  version: process.env.APP_VERSION ?? "0.1.0",
} satisfies HealthHandlerDeps;
