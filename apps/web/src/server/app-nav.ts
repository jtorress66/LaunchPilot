import { can, type Role, type WorkspaceAction } from "@nuvantre/domain";

export interface NavItem {
  readonly href: string;
  readonly label: string;
}

interface Entry {
  readonly href: string;
  readonly label: (inboxCount: number) => string;
  /** What the role must be allowed to do to see it. */
  readonly needs: WorkspaceAction;
  /** Agency-wide pages live on the agency workspace, not inside a client. */
  readonly agencyOnly?: boolean;
}

const entries: readonly Entry[] = [
  { href: "/app", label: () => "Dashboard", needs: "view" },
  {
    href: "/app/inbox",
    label: (n) => (n > 0 ? `Inbox (${String(n)})` : "Inbox"),
    needs: "approve",
  },
  { href: "/app/activity", label: () => "Activity", needs: "view" },
  { href: "/app/clients", label: () => "Clients", needs: "manage_clients", agencyOnly: true },
  { href: "/app/team", label: () => "Team", needs: "manage_team" },
  { href: "/app/branding", label: () => "Branding", needs: "manage_branding", agencyOnly: true },
  { href: "/app/billing", label: () => "Billing", needs: "manage_billing", agencyOnly: true },
];

/** The header's links for this role in this workspace. */
export const appNav = (input: {
  role: Role;
  isClient: boolean;
  inboxCount: number;
}): readonly NavItem[] =>
  entries
    .filter((e) => can(input.role, e.needs) && !(e.agencyOnly && input.isClient))
    .map((e) => ({ href: e.href, label: e.label(input.inboxCount) }));
