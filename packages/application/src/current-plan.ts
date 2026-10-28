import {
  freeSubscription,
  workspacePlan,
  type PlanId,
  type Subscription,
  type WorkspaceId,
} from "@nuvantre/domain";
import type { Clock, SubscriptionRepository, WorkspaceRepository } from "@nuvantre/ports";

export interface PlanDeps {
  readonly subscriptions: SubscriptionRepository;
  readonly workspaces: WorkspaceRepository;
  readonly clock: Clock;
}

/** A workspace, or just its id when the caller has not loaded it (its agency is then looked up). */
export interface PlannedWorkspace {
  readonly id: WorkspaceId;
  readonly agencyId?: WorkspaceId | null;
}

/** The workspace's subscription, treating a missing record as Free. */
export const loadSubscription = async (
  deps: { readonly subscriptions: SubscriptionRepository; readonly clock: Clock },
  workspace: { readonly id: WorkspaceId },
): Promise<Subscription> =>
  (await deps.subscriptions.findByWorkspace(workspace.id)) ??
  freeSubscription(workspace.id, deps.clock.now());

/** The plan whose limits apply now. An agency's client runs on its agency's plan. */
export const currentPlan = async (deps: PlanDeps, workspace: PlannedWorkspace): Promise<PlanId> => {
  const agencyId =
    workspace.agencyId === undefined
      ? ((await deps.workspaces.findById(workspace.id))?.agencyId ?? null)
      : workspace.agencyId;
  return workspacePlan({
    workspace: { agencyId },
    own: await loadSubscription(deps, workspace),
    agency: agencyId === null ? undefined : await deps.subscriptions.findByWorkspace(agencyId),
    now: deps.clock.now(),
  });
};
