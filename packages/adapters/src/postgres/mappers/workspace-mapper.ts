import { userId, workspaceId, type Workspace } from "@nuvantre/domain";
import type { WorkspaceRow } from "../schema";

export const workspaceMapper = {
  toRow: (workspace: Workspace): WorkspaceRow => ({
    id: workspace.id,
    owner_id: workspace.ownerId,
    name: workspace.name,
    created_at: workspace.createdAt,
  }),
  fromRow: (row: WorkspaceRow): Workspace => ({
    id: workspaceId(row.id),
    ownerId: userId(row.owner_id),
    name: row.name,
    createdAt: row.created_at,
  }),
};
