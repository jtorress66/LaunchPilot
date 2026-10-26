import { err, ok, type Result } from "@nuvantre/domain";
import { Migrator, NO_MIGRATIONS, type Kysely, type MigrationResultSet } from "kysely";
import { migrationProvider } from "./migrations";
import type { Database } from "./schema";

export interface MigrationOutcome {
  /** Names of the migrations that ran in this call, in order. */
  readonly applied: readonly string[];
}

const toResult = ({
  error,
  results = [],
}: MigrationResultSet): Result<MigrationOutcome, string> => {
  if (error !== undefined) {
    return err(error instanceof Error ? error.message : "Unknown migration error");
  }
  return ok({ applied: results.filter((r) => r.status === "Success").map((r) => r.migrationName) });
};

const migrator = (db: Kysely<Database>) => new Migrator({ db, provider: migrationProvider });

export const migrateToLatest = async (
  db: Kysely<Database>,
): Promise<Result<MigrationOutcome, string>> => toResult(await migrator(db).migrateToLatest());

/** Rolls back every migration. For tests and local resets only. */
export const migrateDown = async (
  db: Kysely<Database>,
): Promise<Result<MigrationOutcome, string>> =>
  toResult(await migrator(db).migrateTo(NO_MIGRATIONS));
