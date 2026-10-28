import { userId, workspaceId, type Session } from "@nuvantre/domain";
import { sha256Hex } from "../../crypto/sha256";
import type { SessionRow } from "../schema";

/** Sessions are stored by token hash; the raw token only ever lives in the founder's cookie. */
export const sessionMapper = {
  hashToken: sha256Hex,
  toRow: (session: Session): SessionRow => ({
    token_hash: sha256Hex(session.token),
    user_id: session.userId,
    workspace_id: session.workspaceId,
    created_at: session.createdAt,
    expires_at: session.expiresAt,
  }),
  fromRow: (row: SessionRow, token: string): Session => ({
    token,
    userId: userId(row.user_id),
    workspaceId: row.workspace_id === null ? null : workspaceId(row.workspace_id),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }),
};
