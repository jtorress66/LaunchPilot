import { parseDatabaseConfig } from "./config";
import { runMigrations } from "./container";

/** CLI: `pnpm db:migrate`. Applies pending migrations and exits non-zero on failure. */
const config = parseDatabaseConfig(process.env);
if (!config.ok) {
  process.stderr.write(`${config.error}\n`);
  process.exit(1);
}

const result = await runMigrations(config.value);
if (!result.ok) {
  process.stderr.write(`Migration failed: ${result.error}\n`);
  process.exit(1);
}
const { applied } = result.value;
process.stdout.write(
  applied.length === 0 ? "Database is up to date.\n" : `Applied: ${applied.join(", ")}\n`,
);
