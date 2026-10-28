import { aClientWorkspace, aWorkspace } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { workspaceMapper } from "./workspace-mapper";

describe("workspaceMapper", () => {
  it("maps a workspace to snake_case columns", () => {
    const workspace = aWorkspace();
    expect(workspaceMapper.toRow(workspace)).toEqual({
      id: "ws_1",
      owner_id: "user_founder",
      name: "Acme Labs",
      agency_id: null,
      created_at: workspace.createdAt,
    });
  });

  it("round-trips a workspace", () => {
    const workspace = aWorkspace();
    expect(workspaceMapper.fromRow(workspaceMapper.toRow(workspace))).toEqual(workspace);
  });

  it("keeps the agency a client workspace belongs to", () => {
    const client = aClientWorkspace();
    expect(workspaceMapper.toRow(client)).toMatchObject({ id: "ws_client", agency_id: "ws_1" });
    expect(workspaceMapper.fromRow(workspaceMapper.toRow(client))).toEqual(client);
  });
});
