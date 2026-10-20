import { sql, type Kysely } from "kysely";

/** Analytics module: each product's analytics connections and its weekly reports. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("analytics_connections")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("product_id", "text", (col) =>
      col.notNull().references("products.id").onDelete("cascade"),
    )
    .addColumn("provider", "text", (col) => col.notNull())
    // Encrypted by the TokenCipher (AES-256-GCM): a Google refresh token or a Plausible key.
    .addColumn("encrypted_secret", "text", (col) => col.notNull())
    .addColumn("account_email", "text")
    .addColumn("search_console_site", "text")
    .addColumn("ga4_property_id", "text")
    .addColumn("site_id", "text")
    .addColumn("base_url", "text")
    .addColumn("connected_at", "timestamptz", (col) => col.notNull())
    .addUniqueConstraint("analytics_connections_product_provider_unique", [
      "product_id",
      "provider",
    ])
    .addCheckConstraint(
      "analytics_connections_provider_check",
      sql`(provider = 'google' and account_email is not null)
        or (provider = 'plausible' and site_id is not null and base_url is not null)`,
    )
    .addCheckConstraint("analytics_connections_secret_check", sql`encrypted_secret <> ''`)
    .execute();

  await db.schema
    .createTable("weekly_reports")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("product_id", "text", (col) =>
      col.notNull().references("products.id").onDelete("cascade"),
    )
    .addColumn("week_key", "text", (col) => col.notNull())
    .addColumn("week_start", "timestamptz", (col) => col.notNull())
    .addColumn("week_end", "timestamptz", (col) => col.notNull())
    .addColumn("report", "jsonb", (col) => col.notNull())
    .addColumn("notes_error", "text")
    .addColumn("built_at", "timestamptz", (col) => col.notNull())
    .addUniqueConstraint("weekly_reports_product_week_unique", ["product_id", "week_key"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("weekly_reports").execute();
  await db.schema.dropTable("analytics_connections").execute();
}
