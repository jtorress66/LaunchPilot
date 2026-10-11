import type { Insertable, Kysely } from "kysely";
import type { Database } from "./schema";

/** Tables whose primary key is an `id` column. */
type TableWithId = {
  [K in keyof Database]: "id" extends keyof Database[K] ? K : never;
}[keyof Database];

/** Inserts the row, or replaces every column of the row with the same id. */
export const upsert = async <T extends TableWithId>(
  db: Kysely<Database>,
  table: T,
  row: Insertable<Database[T]>,
): Promise<void> => {
  await db
    .insertInto(table)
    .values(row)
    .onConflict((conflict) => conflict.column("id").doUpdateSet(row))
    .execute();
};
