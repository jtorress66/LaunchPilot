import { err, isActive, ok, type Result } from "@nuvantre/domain";
import type {
  Clock,
  MembershipRepository,
  SessionRepository,
  UserRepository,
  WorkspaceRepository,
} from "@nuvantre/ports";
import { failure, type UseCaseError } from "./errors";
import {
  accessibleWorkspaces,
  type WorkspaceAccess,
  type WorkspaceChoice,
} from "./workspace-access";

export interface AuthenticateSessionDeps {
  readonly sessions: SessionRepository;
  readonly users: UserRepository;
  readonly workspaces: WorkspaceRepository;
  readonly memberships: MembershipRepository;
  readonly clock: Clock;
}

export interface Authenticated extends WorkspaceAccess {
  /** Every workspace the person can switch to, for the switcher. */
  readonly workspaces: readonly WorkspaceChoice[];
}

const unauthenticated = () => err(failure("unauthenticated", "Please log in"));

/**
 * Turns a session token into the signed-in person, the workspace in use and their role there:
 * the one they switched to while they can still reach it, otherwise their own.
 */
export class AuthenticateSession {
  constructor(private readonly deps: AuthenticateSessionDeps) {}

  async execute(token: string): Promise<Result<Authenticated, UseCaseError>> {
    const session = await this.deps.sessions.findByToken(token);
    if (!session) return unauthenticated();
    if (!isActive(session, this.deps.clock.now())) {
      await this.deps.sessions.delete(token);
      return err(failure("session_expired", "Your session has expired. Please log in again."));
    }
    const user = await this.deps.users.findById(session.userId);
    if (!user) return unauthenticated();
    const workspaces = await accessibleWorkspaces(this.deps, user.id);
    const own = await this.deps.workspaces.findByOwner(user.id);
    const chosen =
      workspaces.find((c) => c.workspace.id === session.workspaceId) ??
      workspaces.find((c) => c.workspace.id === own?.id) ??
      workspaces[0];
    if (!chosen) return err(failure("workspace_not_found", "No workspace found for this account"));
    return ok({ user, workspace: chosen.workspace, role: chosen.role, workspaces });
  }
}
