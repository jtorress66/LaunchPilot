import { sql, type Kysely } from "kysely";

/**
 * Initial schema. Migrations are immutable snapshots: value lists are written out here rather than
 * imported from the domain, so a later domain change needs a new migration.
 */
const values = (list: readonly string[]) => sql.join(list.map((value) => sql.lit(value)));

const contentStatuses = [
  "draft",
  "in_review",
  "approved",
  "rejected",
  "scheduled",
  "published",
  "failed",
  "archived",
];
const allChannels = [
  "blog",
  "x",
  "linkedin",
  "producthunt",
  "directory",
  "reddit",
  "hackernews",
  "indiehackers",
];
const draftOnlyChannels = ["producthunt", "directory", "reddit", "hackernews", "indiehackers"];

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("workspaces")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("owner_id", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("products")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("workspace_id", "text", (col) => col.notNull().references("workspaces.id"))
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("url", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();
  await db.schema
    .createIndex("products_workspace_id_idx")
    .on("products")
    .column("workspace_id")
    .execute();

  await db.schema
    .createTable("briefs")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("product_id", "text", (col) => col.notNull().references("products.id"))
    .addColumn("version", "integer", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("content", "jsonb", (col) => col.notNull())
    .addColumn("approved_by", "text")
    .addColumn("approved_at", "timestamptz")
    .addColumn("updated_at", "timestamptz", (col) => col.notNull())
    .addCheckConstraint("briefs_version_check", sql`version >= 1`)
    .addCheckConstraint("briefs_status_check", sql`status in (${values(["draft", "approved"])})`)
    .addCheckConstraint(
      "briefs_approval_required",
      sql`status <> 'approved' or (approved_by is not null and approved_at is not null)`,
    )
    .execute();
  await db.schema
    .createIndex("briefs_product_id_updated_at_idx")
    .on("briefs")
    .columns(["product_id", "updated_at desc"])
    .execute();

  await db.schema
    .createTable("campaigns")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("product_id", "text", (col) => col.notNull().references("products.id"))
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("goal", "text", (col) => col.notNull())
    .addColumn("week_starting", "timestamptz", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addCheckConstraint(
      "campaigns_status_check",
      sql`status in (${values(["planned", "active", "completed"])})`,
    )
    .execute();
  await db.schema
    .createIndex("campaigns_product_id_idx")
    .on("campaigns")
    .column("product_id")
    .execute();

  await db.schema
    .createTable("tasks")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("campaign_id", "text", (col) => col.notNull().references("campaigns.id"))
    .addColumn("kind", "text", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addCheckConstraint(
      "tasks_kind_check",
      sql`kind in (${values(["seo_article", "social_post", "launch_submission", "weekly_report"])})`,
    )
    .addCheckConstraint(
      "tasks_status_check",
      sql`status in (${values(["todo", "in_progress", "blocked", "done"])})`,
    )
    .execute();
  await db.schema.createIndex("tasks_campaign_id_idx").on("tasks").column("campaign_id").execute();

  await db.schema
    .createTable("content_items")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("product_id", "text", (col) => col.notNull().references("products.id"))
    .addColumn("task_id", "text", (col) => col.notNull().references("tasks.id"))
    .addColumn("channel", "text", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("body", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("version", "integer", (col) => col.notNull())
    .addColumn("created_by", "jsonb", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addColumn("updated_at", "timestamptz", (col) => col.notNull())
    .addColumn("review_note", "text")
    .addColumn("rejection", "jsonb")
    .addColumn("approved_by", "text")
    .addColumn("approved_at", "timestamptz")
    .addColumn("publish_at", "timestamptz")
    .addColumn("publication_url", "text")
    .addColumn("published_at", "timestamptz")
    .addColumn("failure", "jsonb")
    .addCheckConstraint("content_items_version_check", sql`version >= 1`)
    .addCheckConstraint("content_items_status_check", sql`status in (${values(contentStatuses)})`)
    .addCheckConstraint("content_items_channel_check", sql`channel in (${values(allChannels)})`)
    // Product safety rules, enforced again by the database.
    .addCheckConstraint(
      "content_items_approval_required",
      sql`status not in ('approved', 'scheduled', 'published', 'failed')
          or (approved_by is not null and approved_at is not null)`,
    )
    .addCheckConstraint(
      "content_items_schedule_requires_time",
      sql`status <> 'scheduled' or publish_at is not null`,
    )
    .addCheckConstraint(
      "content_items_draft_only_channel",
      sql`not (channel in (${values(draftOnlyChannels)})
               and status in ('scheduled', 'published', 'failed'))`,
    )
    .execute();
  await db.schema
    .createIndex("content_items_status_publish_at_idx")
    .on("content_items")
    .columns(["status", "publish_at"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of ["content_items", "tasks", "campaigns", "briefs", "products", "workspaces"]) {
    await db.schema.dropTable(table).execute();
  }
}
