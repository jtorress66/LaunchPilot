import { can, type WorkspaceAction } from "@nuvantre/domain";

/** The signed-in access when its role allows the action, else null (the caller refuses). */
export const allowedOrNull = <A extends { readonly role: Parameters<typeof can>[0] }>(
  access: A,
  action: WorkspaceAction,
): A | null => (can(access.role, action) ? access : null);
