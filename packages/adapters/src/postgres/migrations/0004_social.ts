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
    // Ciphertext from the TokenCipher port; the plaintext profile key is never stored.
    .addColumn("encrypted_profile_key", "text", (col) => col.notNull())
    .addColumn("ref_id", "text", (col) => col.notNull())
    .addColumn("linked_channels", sql`text[]`, (col) => col.notNull().defaultTo(sql`'{}'`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addCheckConstraint("social_profiles_provider_check", sql`provider in ('ayrshare')`)
    .addCheckConstraint(
      "social_profiles_linked_channels_check",
      sql`linked_channels <@ array['x', 'linkedin']::text[]`,
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
