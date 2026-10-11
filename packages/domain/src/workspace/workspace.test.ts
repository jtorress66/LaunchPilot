import { describe, expect, it } from "vitest";
import { userId, workspaceId } from "../shared/ids";
import { createWorkspace, renameWorkspace } from "./workspace";

const now = new Date("2026-01-01T00:00:00.000Z");
const input = {
  id: workspaceId("ws_1"),
  ownerId: userId("user_1"),
  name: "  Acme Labs ",
  now,
};

describe("workspace", () => {
  it("is created with a trimmed name, its owner and the given time", () => {
    expect(createWorkspace(input)).toEqual({
      ok: true,
      value: { id: "ws_1", ownerId: "user_1", name: "Acme Labs", createdAt: now },
    });
  });

  it("rejects an empty name", () => {
    expect(createWorkspace({ ...input, name: " " }).ok).toBe(false);
  });

  it("can be renamed without changing the original", () => {
    const created = createWorkspace(input);
    if (!created.ok) throw new Error("setup failed");
    const renamed = renameWorkspace(created.value, "Acme Inc");
    expect(renamed).toEqual({ ok: true, value: { ...created.value, name: "Acme Inc" } });
    expect(created.value.name).toBe("Acme Labs");
  });

  it("rejects renaming to an empty name", () => {
    const created = createWorkspace(input);
    if (!created.ok) throw new Error("setup failed");
    expect(renameWorkspace(created.value, "").ok).toBe(false);
  });
});
