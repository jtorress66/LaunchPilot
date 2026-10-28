import { describe, expect, it } from "vitest";
import { userId, workspaceId } from "../shared/ids";
import { auditActions, createAuditEntry } from "./audit-entry";

const now = new Date("2026-10-28T09:00:00.000Z");
const input = {
  id: "aud_1",
  workspaceId: workspaceId("ws_1"),
  actor: { kind: "founder" as const, userId: userId("usr_1") },
  action: "content_approved" as const,
  subject: { kind: "content" as const, id: "item_1", label: "Cookieless analytics" },
  now,
};

describe("createAuditEntry", () => {
  it("records who did what to which item, and when", () => {
    expect(createAuditEntry(input)).toEqual({
      id: "aud_1",
      workspaceId: "ws_1",
      actor: { kind: "founder", userId: "usr_1" },
      action: "content_approved",
      subject: { kind: "content", id: "item_1", label: "Cookieless analytics" },
      at: now,
    });
  });

  it("keeps a label short and on one line, so an entry never carries a whole post", () => {
    const entry = createAuditEntry({
      ...input,
      subject: { ...input.subject, label: `  Line one\nline two ${"x".repeat(200)}` },
    });
    expect(entry.subject.label).toHaveLength(120);
    expect(entry.subject.label.startsWith("Line one line two")).toBe(true);
    expect(entry.subject.label.endsWith("…")).toBe(true);
  });

  it("names an item without a label by its kind", () => {
    expect(
      createAuditEntry({ ...input, subject: { ...input.subject, label: " " } }).subject.label,
    ).toBe("content");
  });

  it("records the system and agents as actors too", () => {
    expect(createAuditEntry({ ...input, actor: { kind: "system" } }).actor).toEqual({
      kind: "system",
    });
    expect(
      createAuditEntry({ ...input, actor: { kind: "agent", agent: "reviewer" } }).actor,
    ).toEqual({ kind: "agent", agent: "reviewer" });
  });

  it("lists every action the activity page explains", () => {
    expect(auditActions).toEqual([
      "signed_in",
      "product_created",
      "product_archived",
      "product_restored",
      "product_activated",
      "brief_approved",
      "content_approved",
      "content_published",
      "post_scheduled",
      "blog_connected",
      "social_connected",
      "analytics_connected",
      "plan_changed",
      "autopilot_enabled",
      "autopilot_disabled",
      "client_added",
      "member_invited",
      "member_joined",
      "member_removed",
      "branding_updated",
      "report_sent",
    ]);
  });
});
