import type { Directory } from "@launchpilot/domain";
import type { Kysely } from "kysely";
import { directoryMapper } from "./mappers/launch-mappers";
import type { Database } from "./schema";

export interface DirectorySyncOutcome {
  readonly upserted: number;
  /** Entries no longer in the catalogue and not tracked by any product. */
  readonly removed: number;
  /** Entries no longer in the catalogue but kept because a product tracks them. */
  readonly kept: number;
}

/** Makes the `directories` table match the curated catalogue. Idempotent; runs in one transaction. */
export const syncDirectories = (
  db: Kysely<Database>,
  directories: readonly Directory[],
): Promise<DirectorySyncOutcome> =>
  db.transaction().execute(async (trx) => {
    for (const directory of directories) {
      const row = directoryMapper.toRow(directory);
      await trx
        .insertInto("directories")
        .values(row)
        .onConflict((conflict) => conflict.column("slug").doUpdateSet(row))
        .execute();
    }
    const wanted = directories.map((d) => d.slug);
    const stale = await trx
      .selectFrom("directories")
      .select("slug")
      .$if(wanted.length > 0, (q) => q.where("slug", "not in", wanted))
      .execute();
    const tracked = new Set(
      stale.length === 0
        ? []
        : (
            await trx
              .selectFrom("submissions")
              .select("directory_slug")
              .where(
                "directory_slug",
                "in",
                stale.map((s) => s.slug),
              )
              .execute()
          ).map((s) => s.directory_slug),
    );
    const removable = stale.map((s) => s.slug).filter((slug) => !tracked.has(slug));
    if (removable.length > 0) {
      await trx.deleteFrom("directories").where("slug", "in", removable).execute();
    }
    return { upserted: directories.length, removed: removable.length, kept: tracked.size };
  });
