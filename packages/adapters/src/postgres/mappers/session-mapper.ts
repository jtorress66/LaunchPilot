import { userId, type Session } from "@launchpilot/domain";
import { sha256Hex } from "../../crypto/sha256";
import type { SessionRow } from "../schema";

/** Sessions are stored by token hash; the raw token only ever lives in the founder's cookie. */
export const sessionMapper = {
  hashToken: sha256Hex,
  toRow: (session: Session): SessionRow => ({
    token_hash: sha256Hex(session.token),
    user_id: session.userId,
    created_at: session.createdAt,
    expires_at: session.expiresAt,
  }),
  fromRow: (row: SessionRow, token: string): Session => ({
    token,
    userId: userId(row.user_id),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }),
};
