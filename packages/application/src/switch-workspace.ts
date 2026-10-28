import {
  err,
  ok,
  useWorkspace,
  type Result,
  type Workspace,
  type WorkspaceId,
} from "@nuvantre/domain";
import type { SessionRepository } from "@nuvantre/ports";
import { failure, type UseCaseError } from "./errors";
import { roleIn, type AccessDeps } from "./workspace-access";

const notFound = () => err(failure("workspace_not_found", "This workspace does not exist"));

/** Opens another workspace the person can reach; the session remembers it. */
export class SwitchWorkspace {
  constructor(private readonly deps: AccessDeps & { readonly sessions: SessionRepository }) {}

  async execute(input: {
    token: string;
    workspaceId: WorkspaceId;
  }): Promise<Result<Workspace, UseCaseError>> {
    const session = await this.deps.sessions.findByToken(input.token);
    if (!session) return err(failure("unauthenticated", "Please log in"));
    const workspace = await this.deps.workspaces.findById(input.workspaceId);
    if (!workspace || (await roleIn(this.deps, session.userId, workspace)) === null) {
      return notFound();
    }
    await this.deps.sessions.save(useWorkspace(session, workspace.id));
    return ok(workspace);
  }
}
