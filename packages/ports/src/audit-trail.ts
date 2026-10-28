import type { AuditEntry, WorkspaceId } from "@nuvantre/domain";

/** The workspace's history of founder, agent and system actions. Append only. */
export interface AuditTrail {
  record(entry: AuditEntry): Promise<void>;
  /** Newest first; `before` pages back from an entry's time. */
  listByWorkspace(
    workspaceId: WorkspaceId,
    page: { readonly before?: Date; readonly limit: number },
  ): Promise<readonly AuditEntry[]>;
}
