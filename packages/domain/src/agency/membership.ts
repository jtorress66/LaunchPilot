import type { UserId, WorkspaceId } from "../shared/ids";
import type { Role } from "./roles";

/** A person's role in one workspace. */
export interface Membership {
  readonly workspaceId: WorkspaceId;
  readonly userId: UserId;
  readonly role: Role;
  readonly createdAt: Date;
}
