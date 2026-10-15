import { sql, type Kysely } from "kysely";

/** Launch module: the directory catalogue, each product's launch kit, and its submissions. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("directories")
    .addColumn("slug", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("kind", "text", (col) => col.notNull())
    .addColumn("channel", "text", (col) => col.notNull())
    .addColumn("homepage_url", "text", (col) => col.notNull())
    .addColumn("submit_url", "text", (col) => col.notNull())
    .addColumn("pricing", "text", (col) => col.notNull())
    .addColumn("price_note", "text")
    .addColumn("topics", "jsonb", (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("limits", "jsonb", (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn("checked_at", "timestamptz", (col) => col.notNull())
    .addCheckConstraint(
      "directories_kind_check",
      sql`kind in ('launch_platform', 'directory', 'community')`,
    )
    .addCheckConstraint("directories_pricing_check", sql`pricing in ('free', 'freemium', 'paid')`)
    .execute();

  await db.schema
    .createTable("launch_kits")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("product_id", "text", (col) =>
      col.notNull().unique().references("products.id").onDelete("cascade"),
    )
    .addColumn("version", "integer", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("listing", "jsonb", (col) => col.notNull())
    .addColumn("approved_by", "text")
    .addColumn("approved_at", "timestamptz")
    .addColumn("updated_at", "timestamptz", (col) => col.notNull())
    .addCheckConstraint("launch_kits_status_check", sql`status in ('draft', 'approved')`)
    .execute();

  await db.schema
    .createTable("submissions")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("product_id", "text", (col) =>
      col.notNull().references("products.id").onDelete("cascade"),
    )
    // A tracked directory cannot disappear from the catalogue under a founder's feet.
    .addColumn("directory_slug", "text", (col) =>
      col.notNull().references("directories.slug").onDelete("restrict"),
    )
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("submitted_at", "timestamptz")
    .addColumn("listing_url", "text")
    .addColumn("live_at", "timestamptz")
    .addColumn("rejection", "jsonb")
    .addColumn("updated_at", "timestamptz", (col) => col.notNull())
    .addUniqueConstraint("submissions_product_directory_unique", ["product_id", "directory_slug"])
    .addCheckConstraint(
      "submissions_status_check",
      sql`status in ('planned', 'submitted', 'live', 'rejected', 'skipped')`,
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("submissions").execute();
  await db.schema.dropTable("launch_kits").execute();
  await db.schema.dropTable("directories").execute();
}
