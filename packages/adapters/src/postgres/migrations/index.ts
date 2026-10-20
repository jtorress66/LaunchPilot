import type { Migration, MigrationProvider } from "kysely";
import * as initial from "./0001_initial";
import * as accountsBilling from "./0002_accounts_billing";
import * as seo from "./0003_seo";
import * as social from "./0004_social";
import * as launch from "./0005_launch";
import * as analytics from "./0006_analytics";
import * as orchestration from "./0007_orchestration";

/** Ordered list of migrations, bundled with the code (no filesystem lookups at runtime). */
const migrations: Readonly<Record<string, Migration>> = {
  "0001_initial": initial,
  "0002_accounts_billing": accountsBilling,
  "0003_seo": seo,
  "0004_social": social,
  "0005_launch": launch,
  "0006_analytics": analytics,
  "0007_orchestration": orchestration,
};

export const migrationProvider: MigrationProvider = {
  getMigrations: () => Promise.resolve(migrations),
};
