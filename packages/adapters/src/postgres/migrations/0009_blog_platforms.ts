import { sql, type Kysely } from "kysely";

/** More blogs: any of five platforms, with each platform's non-secret settings as jsonb. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("channel_connections")
    .addColumn("settings", "jsonb", (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .execute();
  await sql`UPDATE channel_connections SET settings = jsonb_build_object('username', username)`.execute(
    db,
  );
  await db.schema.alterTable("channel_connections").dropColumn("username").execute();
  await db.schema
    .alterTable("channel_connections")
    .dropConstraint("channel_connections_provider_check")
    .execute();
  await db.schema
    .alterTable("channel_connections")
    .addCheckConstraint(
      "channel_connections_provider_check",
      sql`provider in ('wordpress', 'ghost', 'shopify', 'webflow', 'wix')`,
    )
    .execute();
}

/** Only WordPress connections fit the old shape; the others are removed and must reconnect. */
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM channel_connections WHERE provider <> 'wordpress'`.execute(db);
  await db.schema
    .alterTable("channel_connections")
    .dropConstraint("channel_connections_provider_check")
    .execute();
  await db.schema
    .alterTable("channel_connections")
    .addCheckConstraint("channel_connections_provider_check", sql`provider in ('wordpress')`)
    .execute();
  await db.schema
    .alterTable("channel_connections")
    .addColumn("username", "text", (col) => col.notNull().defaultTo(""))
    .execute();
  await sql`UPDATE channel_connections SET username = coalesce(settings->>'username', '')`.execute(
    db,
  );
  await db.schema
    .alterTable("channel_connections")
    .alterColumn("username", (col) => col.dropDefault())
    .execute();
  await db.schema.alterTable("channel_connections").dropColumn("settings").execute();
}
