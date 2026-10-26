import { err, isActive, ok, type Result, type User, type Workspace } from "@nuvantre/domain";
import type {
  Clock,
  SessionRepository,
  UserRepository,
  WorkspaceRepository,
} from "@nuvantre/ports";
import { failure, type UseCaseError } from "./errors";

export interface AuthenticateSessionDeps {
  readonly sessions: SessionRepository;
  readonly users: UserRepository;
  readonly workspaces: WorkspaceRepository;
  readonly clock: Clock;
}

export interface Authenticated {
  readonly user: User;
  readonly workspace: Workspace;
}

const unauthenticated = () => err(failure("unauthenticated", "Please log in"));

/** Turns a session token into the signed-in founder and their workspace. */
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
    const workspace = await this.deps.workspaces.findByOwner(user.id);
    if (!workspace)
      return err(failure("workspace_not_found", "No workspace found for this account"));
    return ok({ user, workspace });
  }
}
