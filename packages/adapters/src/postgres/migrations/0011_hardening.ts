import { sql, type Kysely } from "kysely";

/** Hardening for beta: rate-limit counters and the workspace audit trail. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("rate_limits")
    .addColumn("key", "text", (col) => col.notNull())
    .addColumn("window_start", "timestamptz", (col) => col.notNull())
    .addColumn("count", "integer", (col) => col.notNull())
    .addPrimaryKeyConstraint("rate_limits_pkey", ["key", "window_start"])
    .execute();

  await db.schema
    .createTable("audit_entries")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("workspace_id", "text", (col) =>
      col.notNull().references("workspaces.id").onDelete("cascade"),
    )
    .addColumn("actor", "jsonb", (col) => col.notNull())
    .addColumn("action", "text", (col) => col.notNull())
    .addColumn("subject", "jsonb", (col) => col.notNull())
    .addColumn("at", "timestamptz", (col) => col.notNull())
    .execute();
  await db.schema
    .createIndex("audit_entries_workspace_at_idx")
    .on("audit_entries")
    .expression(sql`workspace_id, at DESC, id DESC`)
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("audit_entries").execute();
  await db.schema.dropTable("rate_limits").execute();
}
