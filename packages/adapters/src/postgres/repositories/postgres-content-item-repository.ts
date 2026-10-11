import type { ContentItem, ContentItemId, ContentItemStatus } from "@launchpilot/domain";
import type { ContentItemRepository } from "@launchpilot/ports";
import type { Kysely } from "kysely";
import { contentItemMapper } from "../mappers/content-item-mapper";
import type { Database } from "../schema";
import { upsert } from "../upsert";

export class PostgresContentItemRepository implements ContentItemRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: ContentItemId): Promise<ContentItem | undefined> {
    const row = await this.db
      .selectFrom("content_items")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row && contentItemMapper.fromRow(row);
  }

  save(item: ContentItem): Promise<void> {
    return upsert(this.db, "content_items", contentItemMapper.toRow(item));
  }

  /** Earliest publish time first, so a scheduler can work through due items in order. */
  async listByStatus(status: ContentItemStatus): Promise<readonly ContentItem[]> {
    const rows = await this.db
      .selectFrom("content_items")
      .selectAll()
      .where("status", "=", status)
      .orderBy("publish_at", (order) => order.asc().nullsLast())
      .orderBy("id")
      .execute();
    return rows.map(contentItemMapper.fromRow);
  }
}
