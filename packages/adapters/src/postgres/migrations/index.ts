import type { Migration, MigrationProvider } from "kysely";
import * as initial from "./0001_initial";
import * as accountsBilling from "./0002_accounts_billing";
import * as seo from "./0003_seo";
import * as social from "./0004_social";

/** Ordered list of migrations, bundled with the code (no filesystem lookups at runtime). */
const migrations: Readonly<Record<string, Migration>> = {
  "0001_initial": initial,
  "0002_accounts_billing": accountsBilling,
  "0003_seo": seo,
  "0004_social": social,
};

export const migrationProvider: MigrationProvider = {
  getMigrations: () => Promise.resolve(migrations),
};
