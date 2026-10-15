import { parseDatabaseConfig } from "./config";
import { runMigrations } from "./container";

/** CLI: `pnpm db:migrate`. Applies pending migrations, syncs the directory catalogue, exits non-zero on failure. */
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
const { applied, directories } = result.value;
process.stdout.write(
  applied.length === 0 ? "Database is up to date.\n" : `Applied: ${applied.join(", ")}\n`,
);
process.stdout.write(
  `Directory catalogue: ${String(directories.upserted)} entries` +
    (directories.removed > 0 ? `, ${String(directories.removed)} removed` : "") +
    (directories.kept > 0 ? `, ${String(directories.kept)} kept because products track them` : "") +
    ".\n",
);
