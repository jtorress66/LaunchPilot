import { aUser, aWorkspace } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { allowedOrNull } from "./access";

const as = (role: "owner" | "member" | "viewer") => ({
  user: aUser(),
  workspace: aWorkspace(),
  role,
  workspaces: [],
});

describe("allowedOrNull", () => {
  it("passes the signed-in access through when the role allows the action", () => {
    const owner = as("owner");
    expect(allowedOrNull(owner, "manage_billing")).toBe(owner);
    expect(allowedOrNull(as("member"), "approve")?.role).toBe("member");
  });

  it("refuses a client viewer anything but looking, and a member the agency's settings", () => {
    expect(allowedOrNull(as("viewer"), "approve")).toBeNull();
    expect(allowedOrNull(as("viewer"), "draft")).toBeNull();
    expect(allowedOrNull(as("viewer"), "view")?.role).toBe("viewer");
    expect(allowedOrNull(as("member"), "manage_team")).toBeNull();
  });
});
