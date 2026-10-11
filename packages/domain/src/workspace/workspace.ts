import { map, type Result } from "../result";
import type { DomainError } from "../shared/errors";
import type { UserId, WorkspaceId } from "../shared/ids";
import { nonEmptyText } from "../shared/text";

export interface Workspace {
  readonly id: WorkspaceId;
  readonly ownerId: UserId;
  readonly name: string;
  readonly createdAt: Date;
}

const workspaceName = (name: string) => nonEmptyText(name, { field: "Workspace name", max: 100 });

export const createWorkspace = (input: {
  id: WorkspaceId;
  ownerId: UserId;
  name: string;
  now: Date;
}): Result<Workspace, DomainError> =>
  map(workspaceName(input.name), (name) => ({
    id: input.id,
    ownerId: input.ownerId,
    name,
    createdAt: input.now,
  }));

export const renameWorkspace = (
  workspace: Workspace,
  name: string,
): Result<Workspace, DomainError> =>
  map(workspaceName(name), (valid) => ({ ...workspace, name: valid }));
