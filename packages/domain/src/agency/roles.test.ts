import { describe, expect, it } from "vitest";
import { can, roles, workspaceActions } from "./roles";

describe("roles and permissions", () => {
  it("has an owner, a member and a client viewer", () => {
    expect(roles).toEqual(["owner", "member", "viewer"]);
  });

  it("lets the owner do everything", () => {
    for (const action of workspaceActions) expect(can("owner", action)).toBe(true);
  });

  it("lets a member draft, approve, publish and send reports, but not run the business", () => {
    for (const action of [
      "view",
      "draft",
      "approve",
      "publish",
      "connect",
      "send_reports",
    ] as const) {
      expect(can("member", action)).toBe(true);
    }
    for (const action of [
      "manage_billing",
      "manage_team",
      "manage_clients",
      "manage_branding",
    ] as const) {
      expect(can("member", action)).toBe(false);
    }
  });

  it("lets a client viewer only look", () => {
    expect(workspaceActions.filter((action) => can("viewer", action))).toEqual(["view"]);
  });
});
