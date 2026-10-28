import { err, map, type Result } from "../result";
import { domainError, type DomainError } from "../shared/errors";
import type { UserId, WorkspaceId } from "../shared/ids";
import { nonEmptyText } from "../shared/text";

export interface Workspace {
  readonly id: WorkspaceId;
  readonly ownerId: UserId;
  readonly name: string;
  /** The agency this workspace is a client of; null for an agency or a founder's own workspace. */
  readonly agencyId: WorkspaceId | null;
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
    agencyId: null,
    createdAt: input.now,
  }));

/** A client of an agency: owned by the agency's owner, reached by its staff through the agency. */
export const createClientWorkspace = (
  agency: Workspace,
  input: { id: WorkspaceId; name: string; now: Date },
): Result<Workspace, DomainError> => {
  if (agency.agencyId !== null) {
    return err(domainError("nested_client", "A client workspace cannot have clients of its own"));
  }
  return map(workspaceName(input.name), (name) => ({
    id: input.id,
    ownerId: agency.ownerId,
    name,
    agencyId: agency.id,
    createdAt: input.now,
  }));
};

export const renameWorkspace = (
  workspace: Workspace,
  name: string,
): Result<Workspace, DomainError> =>
  map(workspaceName(name), (valid) => ({ ...workspace, name: valid }));
