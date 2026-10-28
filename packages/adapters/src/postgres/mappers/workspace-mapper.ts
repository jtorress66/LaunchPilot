import { userId, workspaceId, type Workspace } from "@nuvantre/domain";
import type { WorkspaceRow } from "../schema";

export const workspaceMapper = {
  toRow: (workspace: Workspace): WorkspaceRow => ({
    id: workspace.id,
    owner_id: workspace.ownerId,
    name: workspace.name,
    agency_id: workspace.agencyId,
    created_at: workspace.createdAt,
  }),
  fromRow: (row: WorkspaceRow): Workspace => ({
    id: workspaceId(row.id),
    ownerId: userId(row.owner_id),
    name: row.name,
    agencyId: row.agency_id === null ? null : workspaceId(row.agency_id),
    createdAt: row.created_at,
  }),
};
