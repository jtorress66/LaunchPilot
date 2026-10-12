import { sql, type Kysely } from "kysely";

/** SEO module: blog connections, the keyword an SEO task targets, per-product content queries. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("channel_connections")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("product_id", "text", (col) =>
      col.notNull().references("products.id").onDelete("cascade"),
    )
    .addColumn("channel", "text", (col) => col.notNull())
    .addColumn("provider", "text", (col) => col.notNull())
    .addColumn("site_url", "text", (col) => col.notNull())
    .addColumn("site_name", "text", (col) => col.notNull())
    .addColumn("username", "text", (col) => col.notNull())
    // Ciphertext from the TokenCipher port; the plaintext secret is never stored.
    .addColumn("encrypted_secret", "text", (col) => col.notNull())
    .addColumn("connected_at", "timestamptz", (col) => col.notNull())
    .addUniqueConstraint("channel_connections_product_channel_unique", ["product_id", "channel"])
    .addCheckConstraint("channel_connections_channel_check", sql`channel in ('blog')`)
    .addCheckConstraint("channel_connections_provider_check", sql`provider in ('wordpress')`)
    .execute();

  await db.schema
    .alterTable("tasks")
    .addColumn("seo_keyword", "text")
    .addColumn("seo_monthly_searches", "integer")
    .addColumn("seo_difficulty", "integer")
    .execute();

  await db.schema
    .createIndex("content_items_product_created_idx")
    .on("content_items")
    .columns(["product_id", "created_at"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("content_items_product_created_idx").execute();
  await db.schema
    .alterTable("tasks")
    .dropColumn("seo_keyword")
    .dropColumn("seo_monthly_searches")
    .dropColumn("seo_difficulty")
    .execute();
  await db.schema.dropTable("channel_connections").execute();
}
