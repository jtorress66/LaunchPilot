import type { Workspace } from "../workspace/workspace";
import type { Membership } from "./membership";
import type { Role } from "./roles";

/**
 * A user's role in a workspace, or null without access. A direct membership wins; otherwise an
 * agency's owners and members keep their role in each of its clients. Agency viewers do not.
 */
export const resolveRole = (input: {
  workspace: Workspace;
  direct?: Membership | undefined;
  viaAgency?: Membership | undefined;
}): Role | null => {
  if (input.direct) return input.direct.role;
  const inherited = input.viaAgency;
  if (input.workspace.agencyId === null || !inherited) return null;
  if (inherited.workspaceId !== input.workspace.agencyId) return null;
  return inherited.role === "viewer" ? null : inherited.role;
};
