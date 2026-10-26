import { channels, contentItemStatuses, isAutoPublishable } from "@nuvantre/domain";
import { aContentItem } from "@nuvantre/testing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PostgresContentItemRepository } from "../../src/postgres";
import { connect, resetWith } from "./test-db";

const db = connect();
const repo = new PostgresContentItemRepository(db);

beforeEach(async () => {
  await resetWith(db, "tasks");
});
afterAll(async () => {
  await db.destroy();
});

describe("PostgresContentItemRepository", () => {
  it.each(contentItemStatuses)(
    "stores and reloads a %s item with all of its history fields",
    async (status) => {
      const item = aContentItem({ status });
      await repo.save(item);
      expect(await repo.findById(item.id)).toEqual(item);
    },
  );

  it.each(channels)("stores a draft for the %s channel", async (channel) => {
    const item = aContentItem({ channel });
    await repo.save(item);
    expect(await repo.findById(item.id)).toEqual(item);
  });

  it.each(channels.filter((channel) => !isAutoPublishable(channel)))(
    "stores an approved %s draft for the founder to post by hand",
    async (channel) => {
      const item = aContentItem({ channel, status: "approved" });
      await repo.save(item);
      expect(await repo.findById(item.id)).toEqual(item);
    },
  );
});
