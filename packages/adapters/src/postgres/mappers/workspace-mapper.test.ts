import { aWorkspace } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { workspaceMapper } from "./workspace-mapper";

describe("workspaceMapper", () => {
  it("maps a workspace to snake_case columns", () => {
    const workspace = aWorkspace();
    expect(workspaceMapper.toRow(workspace)).toEqual({
      id: "ws_1",
      owner_id: "user_founder",
      name: "Acme Labs",
      created_at: workspace.createdAt,
    });
  });

  it("round-trips a workspace", () => {
    const workspace = aWorkspace();
    expect(workspaceMapper.fromRow(workspaceMapper.toRow(workspace))).toEqual(workspace);
  });
});
