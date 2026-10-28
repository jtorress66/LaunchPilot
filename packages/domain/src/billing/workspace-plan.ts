import type { Workspace } from "../workspace/workspace";
import type { PlanId } from "./plans";
import { effectivePlan, type Subscription } from "./subscription";

/**
 * The plan whose limits apply to a workspace. A client workspace pays nothing itself: it runs on
 * the client plan while its agency is on Agency, and on Free otherwise.
 */
export const workspacePlan = (input: {
  workspace: Pick<Workspace, "agencyId">;
  own: Subscription;
  agency: Subscription | undefined;
  now: Date;
}): PlanId => {
  if (input.workspace.agencyId === null) return effectivePlan(input.own, input.now);
  const agencyPlan = input.agency ? effectivePlan(input.agency, input.now) : "free";
  return agencyPlan === "agency" ? "client" : "free";
};
