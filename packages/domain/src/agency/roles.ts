export const roles = ["owner", "member", "viewer"] as const;
export type Role = (typeof roles)[number];

/** Everything a person may do in a workspace. Data, so a new action is one more entry. */
export const workspaceActions = [
  "view",
  "draft",
  "approve",
  "publish",
  "connect",
  "manage_products",
  "manage_billing",
  "manage_team",
  "manage_clients",
  "manage_branding",
  "send_reports",
] as const;
export type WorkspaceAction = (typeof workspaceActions)[number];

const staff: readonly WorkspaceAction[] = [
  "view",
  "draft",
  "approve",
  "publish",
  "connect",
  "manage_products",
  "send_reports",
];

/** Who may do what. A client viewer only looks: nothing they do can reach a public channel. */
const permissions: Readonly<Record<Role, readonly WorkspaceAction[]>> = {
  owner: workspaceActions,
  member: staff,
  viewer: ["view"],
};

export const can = (role: Role, action: WorkspaceAction): boolean =>
  permissions[role].includes(action);

export const isRole = (value: string): value is Role =>
  (roles as readonly string[]).includes(value);
