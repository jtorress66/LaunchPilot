import { sql, type Kysely } from "kysely";

/** Social module: per-product social profiles and publish attempts (due items use 0001's index). */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("social_profiles")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("product_id", "text", (col) =>
      col.notNull().unique().references("products.id").onDelete("cascade"),
    )
    .addColumn("provider", "text", (col) => col.notNull())
    // The provider's profile id. Not a secret: the API key lives in configuration only.
    .addColumn("external_profile_id", "text", (col) => col.notNull())
    // [{ channel, accountId }], one per linked X or LinkedIn account.
    .addColumn("linked_accounts", "jsonb", (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addCheckConstraint("social_profiles_provider_check", sql`provider in ('zernio')`)
    .addCheckConstraint(
      "social_profiles_linked_accounts_check",
      sql`jsonb_typeof(linked_accounts) = 'array'`,
    )
    .execute();

  await db.schema
    .alterTable("content_items")
    .addColumn("publish_attempts", "integer", (col) => col.notNull().defaultTo(0))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("content_items").dropColumn("publish_attempts").execute();
  await db.schema.dropTable("social_profiles").execute();
}
