import { productId, workspaceId } from "@nuvantre/domain";
import { aBrief, aContentItem, aGoogleConnection, aProduct } from "@nuvantre/testing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { analyticsConnectionMapper } from "../../src/postgres/mappers/analytics-mappers";
import { briefMapper } from "../../src/postgres/mappers/brief-mapper";
import { contentItemMapper } from "../../src/postgres/mappers/content-item-mapper";
import { productMapper } from "../../src/postgres/mappers/product-mapper";
import { connect, resetWith } from "./test-db";

/**
 * Defence in depth: even if application code had a bug, Postgres refuses rows that would break
 * the product safety rules.
 */
const db = connect();

beforeEach(async () => {
  await resetWith(db, "tasks");
});
afterAll(async () => {
  await db.destroy();
});

const insertItem = (row: ReturnType<typeof contentItemMapper.toRow>) =>
  db.insertInto("content_items").values(row).execute();

describe("database safety constraints", () => {
  it.each(["reddit", "hackernews", "indiehackers", "producthunt", "directory"])(
    "refuses a scheduled %s item",
    async (channel) => {
      const row = { ...contentItemMapper.toRow(aContentItem({ status: "scheduled" })), channel };
      await expect(insertItem(row)).rejects.toThrow(/content_items_draft_only_channel/);
    },
  );

  it.each(["approved", "scheduled", "published", "failed"] as const)(
    "refuses a %s item without a founder approval",
    async (status) => {
      const row = {
        ...contentItemMapper.toRow(aContentItem({ status })),
        approved_by: null,
        approved_at: null,
      };
      await expect(insertItem(row)).rejects.toThrow(/content_items_approval_required/);
    },
  );

  it("refuses a scheduled item without a publish time", async () => {
    const row = {
      ...contentItemMapper.toRow(aContentItem({ status: "scheduled" })),
      publish_at: null,
    };
    await expect(insertItem(row)).rejects.toThrow(/content_items_schedule_requires_time/);
  });

  it("refuses an unknown status", async () => {
    const row = { ...contentItemMapper.toRow(aContentItem()), status: "live" };
    await expect(insertItem(row)).rejects.toThrow(/content_items_status_check/);
  });

  it("refuses an approved brief without approval details", async () => {
    const row = { ...briefMapper.toRow(aBrief({ status: "approved" })), approved_by: null };
    await expect(db.insertInto("briefs").values(row).execute()).rejects.toThrow(
      /briefs_approval_required/,
    );
  });

  it("refuses a product whose workspace does not exist", async () => {
    const row = productMapper.toRow(
      aProduct({ id: productId("prod_9"), workspaceId: workspaceId("ws_missing") }),
    );
    await expect(db.insertInto("products").values(row).execute()).rejects.toThrow(/foreign key/);
  });

  it.each([
    ["a Google connection without its account", { account_email: null }, /provider_check/],
    ["a connection without its secret", { encrypted_secret: "" }, /secret_check/],
  ])("refuses %s", async (_case, override, constraint) => {
    const row = { ...analyticsConnectionMapper.toRow(aGoogleConnection()), ...override };
    await expect(db.insertInto("analytics_connections").values(row).execute()).rejects.toThrow(
      constraint,
    );
  });
});
