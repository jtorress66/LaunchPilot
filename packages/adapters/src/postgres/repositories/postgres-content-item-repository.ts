import type { ContentItem, ContentItemId, ContentItemStatus, ProductId } from "@nuvantre/domain";
import type { ContentItemRepository } from "@nuvantre/ports";
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

  async listByStatusForProducts(
    status: ContentItemStatus,
    productIds: readonly ProductId[],
  ): Promise<readonly ContentItem[]> {
    if (productIds.length === 0) return [];
    const rows = await this.db
      .selectFrom("content_items")
      .selectAll()
      .where("status", "=", status)
      .where("product_id", "in", productIds)
      .orderBy("updated_at")
      .orderBy("id")
      .execute();
    return rows.map(contentItemMapper.fromRow);
  }

  async listByProduct(productId: ProductId): Promise<readonly ContentItem[]> {
    const rows = await this.db
      .selectFrom("content_items")
      .selectAll()
      .where("product_id", "=", productId)
      .orderBy("created_at", "desc")
      .orderBy("id")
      .execute();
    return rows.map(contentItemMapper.fromRow);
  }

  async countCreatedSince(productIds: readonly ProductId[], since: Date): Promise<number> {
    if (productIds.length === 0) return 0;
    const { count } = await this.db
      .selectFrom("content_items")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("product_id", "in", productIds)
      .where("created_at", ">=", since)
      .executeTakeFirstOrThrow();
    return Number(count);
  }
}
