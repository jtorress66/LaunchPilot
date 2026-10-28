import {
  can,
  err,
  ok,
  resolveRole,
  type Result,
  type Role,
  type User,
  type UserId,
  type Workspace,
  type WorkspaceAction,
  type WorkspaceId,
} from "@nuvantre/domain";
import type { MembershipRepository, WorkspaceRepository } from "@nuvantre/ports";
import { failure, type UseCaseError } from "./errors";

/** Who is acting, in which workspace, with which role. Every agency-aware use case takes this. */
export interface WorkspaceAccess {
  readonly user: User;
  readonly workspace: Workspace;
  readonly role: Role;
}

export interface WorkspaceChoice {
  readonly workspace: Workspace;
  readonly role: Role;
}

export interface AccessDeps {
  readonly memberships: MembershipRepository;
  readonly workspaces: WorkspaceRepository;
}

/** Ok when the role allows the action; otherwise a refusal the person can read. */
export const authorize = (
  access: Pick<WorkspaceAccess, "role">,
  action: WorkspaceAction,
): Result<null, UseCaseError> =>
  can(access.role, action)
    ? ok(null)
    : err(failure("forbidden", "Your role in this workspace does not allow this"));

/** The person's role in a workspace, directly or through its agency; null without access. */
export const roleIn = async (
  deps: AccessDeps,
  userId: UserId,
  workspace: Workspace,
): Promise<Role | null> =>
  resolveRole({
    workspace,
    direct: await deps.memberships.find(workspace.id, userId),
    viaAgency:
      workspace.agencyId === null
        ? undefined
        : await deps.memberships.find(workspace.agencyId, userId),
  });

/** Every workspace the person can open: each membership, followed by that agency's clients. */
export const accessibleWorkspaces = async (
  deps: AccessDeps,
  userId: UserId,
): Promise<readonly WorkspaceChoice[]> => {
  const choices = new Map<WorkspaceId, WorkspaceChoice>();
  for (const membership of await deps.memberships.listByUser(userId)) {
    const workspace = await deps.workspaces.findById(membership.workspaceId);
    if (!workspace) continue;
    choices.set(workspace.id, { workspace, role: membership.role });
    if (membership.role === "viewer" || workspace.agencyId !== null) continue;
    for (const client of await deps.workspaces.listClients(workspace.id)) {
      if (!choices.has(client.id))
        choices.set(client.id, { workspace: client, role: membership.role });
    }
  }
  return [...choices.values()];
};
