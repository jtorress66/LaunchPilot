import { sql, type Kysely } from "kysely";

/** Agencies: client workspaces, memberships with roles, invitations and branded report email. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("workspaces")
    .addColumn("agency_id", "text", (col) => col.references("workspaces.id").onDelete("cascade"))
    .execute();
  await db.schema
    .createIndex("workspaces_agency_idx")
    .on("workspaces")
    .column("agency_id")
    .execute();

  await db.schema
    .alterTable("sessions")
    .addColumn("workspace_id", "text", (col) =>
      col.references("workspaces.id").onDelete("set null"),
    )
    .execute();

  await db.schema
    .createTable("memberships")
    .addColumn("workspace_id", "text", (col) =>
      col.notNull().references("workspaces.id").onDelete("cascade"),
    )
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("role", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addPrimaryKeyConstraint("memberships_pkey", ["workspace_id", "user_id"])
    .execute();
  await db.schema.createIndex("memberships_user_idx").on("memberships").column("user_id").execute();
  // Every existing workspace's owner becomes its owner member.
  await sql`INSERT INTO memberships (workspace_id, user_id, role, created_at)
    SELECT id, owner_id, 'owner', created_at FROM workspaces`.execute(db);

  await db.schema
    .createTable("invitations")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("workspace_id", "text", (col) =>
      col.notNull().references("workspaces.id").onDelete("cascade"),
    )
    .addColumn("email", "text", (col) => col.notNull())
    .addColumn("role", "text", (col) => col.notNull())
    .addColumn("token_hash", "text", (col) => col.notNull().unique())
    .addColumn("invited_by", "text", (col) =>
      col.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("accepted_at", "timestamptz")
    .execute();
  await db.schema
    .createIndex("invitations_workspace_idx")
    .on("invitations")
    .column("workspace_id")
    .execute();

  await db.schema
    .createTable("report_branding")
    .addColumn("workspace_id", "text", (col) =>
      col.primaryKey().references("workspaces.id").onDelete("cascade"),
    )
    .addColumn("sender_name", "text", (col) => col.notNull())
    .addColumn("accent_color", "text", (col) => col.notNull())
    .addColumn("logo_url", "text")
    .addColumn("reply_to", "text", (col) => col.notNull())
    .addColumn("footer", "text")
    .execute();

  await db.schema
    .createTable("report_recipients")
    .addColumn("product_id", "text", (col) =>
      col.primaryKey().references("products.id").onDelete("cascade"),
    )
    .addColumn("emails", "jsonb", (col) => col.notNull())
    .addColumn("weekly", "boolean", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("report_recipients").execute();
  await db.schema.dropTable("report_branding").execute();
  await db.schema.dropTable("invitations").execute();
  await db.schema.dropTable("memberships").execute();
  await db.schema.alterTable("sessions").dropColumn("workspace_id").execute();
  // Client workspaces only exist with agencies; they go with the column.
  await sql`DELETE FROM workspaces WHERE agency_id IS NOT NULL`.execute(db);
  await db.schema.alterTable("workspaces").dropColumn("agency_id").execute();
}
