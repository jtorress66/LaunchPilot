import {
  auditActions,
  createAuditEntry,
  userId,
  workspaceId,
  type AuditAction,
  type AuditEntry,
} from "@nuvantre/domain";
import { describe, expect, it } from "vitest";
import { describeActivity } from "./activity";

const entry = (overrides: Partial<Parameters<typeof createAuditEntry>[0]> = {}): AuditEntry =>
  createAuditEntry({
    id: "aud_1",
    workspaceId: workspaceId("ws_1"),
    actor: { kind: "founder", userId: userId("usr_1") },
    action: "content_approved",
    subject: { kind: "content", id: "ci_1", label: "Ship faster" },
    now: new Date("2026-10-27T10:00:00Z"),
    ...overrides,
  });

describe("describeActivity", () => {
  it("tells the founder what they did, linking to the item", () => {
    expect(describeActivity(entry())).toEqual({
      sentence: "You approved “Ship faster”",
      href: "/app/content/ci_1",
    });
  });

  it("names Nuvantre for scheduled work and an agent by its role", () => {
    expect(
      describeActivity(entry({ actor: { kind: "system" }, action: "content_published" })).sentence,
    ).toBe("Nuvantre published “Ship faster”");
    expect(
      describeActivity(entry({ actor: { kind: "agent", agent: "seo" }, action: "post_scheduled" }))
        .sentence,
    ).toBe("Your SEO agent scheduled “Ship faster”");
  });

  it("links products to their brief and plan changes to billing", () => {
    expect(
      describeActivity(
        entry({
          action: "product_created",
          subject: { kind: "product", id: "prod_1", label: "Acme" },
        }),
      ),
    ).toEqual({ sentence: "You added Acme", href: "/app/products/prod_1/brief" });
    expect(
      describeActivity(
        entry({
          actor: { kind: "system" },
          action: "plan_changed",
          subject: { kind: "plan", id: "pro", label: "Pro" },
        }),
      ),
    ).toEqual({ sentence: "Nuvantre changed your plan to Pro", href: "/app/billing" });
  });

  it.each(auditActions)("has a sentence for %s", (action: AuditAction) => {
    const { sentence } = describeActivity(entry({ action }));
    expect(sentence).toMatch(/^You \S/);
    expect(sentence).not.toContain("undefined");
  });
});
