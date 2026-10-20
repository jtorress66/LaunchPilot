import { contentItemStatuses, withAgentReview } from "@launchpilot/domain";
import { aContentItem } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { contentItemMapper } from "./content-item-mapper";

describe("contentItemMapper", () => {
  it.each(contentItemStatuses)("round-trips a %s item", (status) => {
    const item = aContentItem({ status });
    expect(contentItemMapper.fromRow(contentItemMapper.toRow(item))).toEqual(item);
  });

  it("round-trips an approved item on a draft-only channel", () => {
    const item = aContentItem({ channel: "reddit", status: "approved" });
    expect(contentItemMapper.fromRow(contentItemMapper.toRow(item))).toEqual(item);
  });

  it("round-trips the reviewer agent's verdict as JSON", () => {
    const item = withAgentReview(aContentItem(), {
      decision: "needs_changes",
      issues: [{ severity: "blocker", message: "Over the limit" }],
      redrafted: true,
      reviewedAt: new Date("2026-10-19T07:05:00.000Z"),
    });
    const row = contentItemMapper.toRow(item);
    expect(JSON.parse(row.agent_review ?? "null")).toMatchObject({
      reviewedAt: "2026-10-19T07:05:00.000Z",
    });
    expect(contentItemMapper.fromRow(row)).toEqual(item);
    expect(contentItemMapper.toRow(aContentItem()).agent_review).toBeNull();
  });

  it("stores the publish attempt count", () => {
    const item = { ...aContentItem({ status: "scheduled" }), publishAttempts: 2 };
    const row = contentItemMapper.toRow(item);
    expect(row.publish_attempts).toBe(2);
    expect(contentItemMapper.fromRow(row)).toEqual(item);
  });

  it("flattens approval and publication into columns", () => {
    const item = aContentItem({ status: "published" });
    expect(contentItemMapper.toRow(item)).toMatchObject({
      status: "published",
      approved_by: "user_founder",
      approved_at: item.approval?.at,
      publication_url: "https://acme.dev/blog/launch",
      published_at: item.publication?.at,
    });
  });

  it("stores who created, rejected or failed an item as JSON with ISO timestamps", () => {
    const rejected = contentItemMapper.toRow(aContentItem({ status: "rejected" }));
    expect(JSON.parse(rejected.created_by)).toEqual({ kind: "agent", agent: "seo" });
    expect(JSON.parse(rejected.rejection ?? "null")).toMatchObject({
      reason: "Off-brand",
      at: "2026-01-05T09:00:00.000Z",
    });
    const failed = contentItemMapper.toRow(aContentItem({ status: "failed" }));
    expect(JSON.parse(failed.failure ?? "null")).toEqual({
      reason: "Platform timeout",
      at: "2026-01-05T09:00:00.000Z",
    });
  });

  it.each([
    ["status", "deleted", /content_items\.status/],
    ["channel", "myspace", /content_items\.channel/],
  ] as const)("refuses an unknown %s", (column, value, message) => {
    const row = { ...contentItemMapper.toRow(aContentItem()), [column]: value };
    expect(() => contentItemMapper.fromRow(row)).toThrow(message);
  });

  it("refuses an unknown actor kind in created_by", () => {
    const row = {
      ...contentItemMapper.toRow(aContentItem()),
      created_by: JSON.stringify({ kind: "robot" }),
    };
    expect(() => contentItemMapper.fromRow(row)).toThrow(/content_items\.created_by/);
  });
});
