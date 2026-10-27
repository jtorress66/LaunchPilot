import { sql, type Kysely } from "kysely";

/** SEO polish: a language and market per product, and a URL slug and excerpt per article. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("products")
    .addColumn("locale", "text", (col) => col.notNull().defaultTo(sql`'en-US'`))
    .execute();
  await db.schema.alterTable("content_items").addColumn("seo", "jsonb").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("content_items").dropColumn("seo").execute();
  await db.schema.alterTable("products").dropColumn("locale").execute();
}
