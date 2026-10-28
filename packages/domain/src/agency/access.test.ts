import { describe, expect, it } from "vitest";
import { userId, workspaceId } from "../shared/ids";
import type { Workspace } from "../workspace/workspace";
import { resolveRole } from "./access";
import type { Membership } from "./membership";

const now = new Date("2026-10-01T00:00:00Z");
const agency: Workspace = {
  id: workspaceId("ws_agency"),
  ownerId: userId("usr_owner"),
  name: "Brightside",
  agencyId: null,
  createdAt: now,
};
const client: Workspace = {
  ...agency,
  id: workspaceId("ws_client"),
  name: "Acme",
  agencyId: agency.id,
};
const member = (ws: Workspace, role: Membership["role"]): Membership => ({
  workspaceId: ws.id,
  userId: userId("usr_1"),
  role,
  createdAt: now,
});

describe("resolveRole", () => {
  it("uses a direct membership first", () => {
    expect(
      resolveRole({
        workspace: client,
        direct: member(client, "viewer"),
        viaAgency: member(agency, "owner"),
      }),
    ).toBe("viewer");
  });

  it("gives agency owners and members the same role in every client", () => {
    expect(resolveRole({ workspace: client, viaAgency: member(agency, "owner") })).toBe("owner");
    expect(resolveRole({ workspace: client, viaAgency: member(agency, "member") })).toBe("member");
  });

  it("does not open clients to an agency viewer or to outsiders", () => {
    expect(resolveRole({ workspace: client, viaAgency: member(agency, "viewer") })).toBeNull();
    expect(resolveRole({ workspace: client })).toBeNull();
  });

  it("ignores agency membership for a workspace that is not a client", () => {
    expect(resolveRole({ workspace: agency, viaAgency: member(agency, "owner") })).toBeNull();
  });
});
