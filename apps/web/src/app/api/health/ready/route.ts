import { getAppContainer } from "../../../../container";
import { createReadinessHandler } from "../../../../server/readiness-handler";

export const dynamic = "force-dynamic";

/** Readiness for the load balancer: can this instance reach what it needs to serve requests? */
export function GET(): Promise<Response> {
  return createReadinessHandler(getAppContainer().readiness)();
}
