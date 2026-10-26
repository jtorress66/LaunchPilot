import { sql, type Kysely } from "kysely";

/** Orchestration: the weekly autopilot switch, the reviewer agent's verdicts, and loop runs. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("products").addColumn("autopilot_since", "timestamptz").execute();
  await db.schema.alterTable("content_items").addColumn("agent_review", "jsonb").execute();
  await db.schema
    .createTable("autopilot_runs")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("product_id", "text", (col) =>
      col.notNull().references("products.id").onDelete("cascade"),
    )
    .addColumn("week_start", "timestamptz", (col) => col.notNull())
    .addColumn("week_end", "timestamptz", (col) => col.notNull())
    .addColumn("outcome", "jsonb", (col) => col.notNull())
    .addColumn("ran_at", "timestamptz", (col) => col.notNull())
    // At most one loop per product and week, even if two runs race.
    .addUniqueConstraint("autopilot_runs_product_week_unique", ["product_id", "week_start"])
    .addCheckConstraint(
      "autopilot_runs_outcome_check",
      sql`outcome->>'kind' in ('completed', 'skipped', 'failed')`,
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("autopilot_runs").execute();
  await db.schema.alterTable("content_items").dropColumn("agent_review").execute();
  await db.schema.alterTable("products").dropColumn("autopilot_since").execute();
}
