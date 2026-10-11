import { sql, type Kysely } from "kysely";

/** Founder accounts, sessions and per-workspace subscriptions. Immutable once released. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("users")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("email", "text", (col) => col.notNull())
    .addColumn("password_hash", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();
  await sql`CREATE UNIQUE INDEX users_email_unique ON users (lower(email))`.execute(db);

  await db.schema
    .alterTable("workspaces")
    .addForeignKeyConstraint("workspaces_owner_id_fkey", ["owner_id"], "users", ["id"])
    .execute();
  await db.schema
    .createIndex("workspaces_owner_id_idx")
    .on("workspaces")
    .column("owner_id")
    .execute();

  await db.schema
    .createTable("sessions")
    .addColumn("token_hash", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .execute();
  await db.schema
    .createIndex("sessions_expires_at_idx")
    .on("sessions")
    .column("expires_at")
    .execute();

  await db.schema
    .createTable("subscriptions")
    .addColumn("workspace_id", "text", (col) =>
      col.primaryKey().references("workspaces.id").onDelete("cascade"),
    )
    .addColumn("plan", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("provider_customer_id", "text")
    .addColumn("provider_subscription_id", "text", (col) => col.unique())
    .addColumn("current_period_end", "timestamptz")
    .addColumn("updated_at", "timestamptz", (col) => col.notNull())
    .addCheckConstraint("subscriptions_plan_check", sql`plan in ('free', 'starter', 'growth')`)
    .addCheckConstraint(
      "subscriptions_status_check",
      sql`status in ('active', 'past_due', 'canceled')`,
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("subscriptions").execute();
  await db.schema.dropTable("sessions").execute();
  await db.schema.alterTable("workspaces").dropConstraint("workspaces_owner_id_fkey").execute();
  await db.schema.dropIndex("workspaces_owner_id_idx").execute();
  await db.schema.dropTable("users").execute();
}
