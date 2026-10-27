import { createAuditEntry, userId, workspaceId, type AuditEntry } from "@nuvantre/domain";
import type { AuditTrail } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";

const entry = (
  id: string,
  minute: number,
  overrides: Partial<Parameters<typeof createAuditEntry>[0]> = {},
): AuditEntry =>
  createAuditEntry({
    id,
    workspaceId: workspaceId("ws_1"),
    actor: { kind: "founder", userId: userId("usr_1") },
    action: "content_approved",
    subject: { kind: "content", id: "item_1", label: `Article ${id}` },
    now: new Date(Date.UTC(2026, 9, 28, 9, minute)),
    ...overrides,
  });

export function describeAuditTrailContract(
  name: string,
  make: () => AuditTrail | Promise<AuditTrail>,
): void {
  describe(`AuditTrail contract: ${name}`, () => {
    it("lists a workspace's entries newest first, and only its own", async () => {
      const trail = await make();
      const [a, b] = [entry("aud_1", 1), entry("aud_2", 2)];
      await trail.record(a);
      await trail.record(b);
      await trail.record(entry("aud_3", 3, { workspaceId: workspaceId("ws_2") }));
      expect(await trail.listByWorkspace(workspaceId("ws_1"), { limit: 10 })).toEqual([b, a]);
    });

    it("pages back from a time, at most `limit` at a time", async () => {
      const trail = await make();
      const entries = [1, 2, 3, 4].map((m) => entry(`aud_${String(m)}`, m));
      for (const e of entries) await trail.record(e);
      const first = await trail.listByWorkspace(workspaceId("ws_1"), { limit: 2 });
      expect(first.map((e) => e.id)).toEqual(["aud_4", "aud_3"]);
      const oldest = first.at(-1);
      if (!oldest) throw new Error("expected a first page");
      const next = await trail.listByWorkspace(workspaceId("ws_1"), {
        limit: 2,
        before: oldest.at,
      });
      expect(next.map((e) => e.id)).toEqual(["aud_2", "aud_1"]);
    });

    it("keeps agent and system actors and the subject as recorded", async () => {
      const trail = await make();
      const byAgent = entry("aud_1", 1, {
        actor: { kind: "agent", agent: "reviewer" },
        action: "post_scheduled",
      });
      const bySystem = entry("aud_2", 2, {
        actor: { kind: "system" },
        action: "plan_changed",
        subject: { kind: "plan", id: "growth", label: "Growth" },
      });
      await trail.record(byAgent);
      await trail.record(bySystem);
      expect(await trail.listByWorkspace(workspaceId("ws_1"), { limit: 10 })).toEqual([
        bySystem,
        byAgent,
      ]);
    });
  });
}
