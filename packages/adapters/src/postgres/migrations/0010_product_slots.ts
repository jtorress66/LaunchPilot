import { sql, type Kysely } from "kysely";

/** Several products: archiving, and each product's place in the plan's product slots. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("products")
    .addColumn("archived_at", "timestamptz")
    .addColumn("slot_order", "timestamptz")
    .execute();
  // Existing products keep today's behaviour: the oldest fill the slots first.
  await sql`UPDATE products SET slot_order = created_at`.execute(db);
  await db.schema
    .alterTable("products")
    .alterColumn("slot_order", (col) => col.setNotNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("products")
    .dropColumn("slot_order")
    .dropColumn("archived_at")
    .execute();
}
