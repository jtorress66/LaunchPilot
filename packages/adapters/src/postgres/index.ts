import type { Kysely } from "kysely";
import { PostgresBriefRepository } from "./repositories/postgres-brief-repository";
import { PostgresCampaignRepository } from "./repositories/postgres-campaign-repository";
import { PostgresContentItemRepository } from "./repositories/postgres-content-item-repository";
import { PostgresProductRepository } from "./repositories/postgres-product-repository";
import { PostgresTaskRepository } from "./repositories/postgres-task-repository";
import { PostgresWorkspaceRepository } from "./repositories/postgres-workspace-repository";
import type { Database } from "./schema";

export type { Database } from "./schema";
export { createDatabase } from "./database";
export { migrateDown, migrateToLatest, type MigrationOutcome } from "./migrate";
export {
  PostgresBriefRepository,
  PostgresCampaignRepository,
  PostgresContentItemRepository,
  PostgresProductRepository,
  PostgresTaskRepository,
  PostgresWorkspaceRepository,
};

/** Every repository over one connection pool, for composition roots. */
export const createPostgresRepositories = (db: Kysely<Database>) => ({
  workspaces: new PostgresWorkspaceRepository(db),
  products: new PostgresProductRepository(db),
  briefs: new PostgresBriefRepository(db),
  campaigns: new PostgresCampaignRepository(db),
  tasks: new PostgresTaskRepository(db),
  contentItems: new PostgresContentItemRepository(db),
});
