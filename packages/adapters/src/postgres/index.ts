import type { Kysely } from "kysely";
import { PostgresBriefRepository } from "./repositories/postgres-brief-repository";
import { PostgresCampaignRepository } from "./repositories/postgres-campaign-repository";
import { PostgresChannelConnectionRepository } from "./repositories/postgres-channel-connection-repository";
import { PostgresContentItemRepository } from "./repositories/postgres-content-item-repository";
import { PostgresProductRepository } from "./repositories/postgres-product-repository";
import { PostgresSessionRepository } from "./repositories/postgres-session-repository";
import { PostgresSocialProfileRepository } from "./repositories/postgres-social-profile-repository";
import { PostgresSubscriptionRepository } from "./repositories/postgres-subscription-repository";
import { PostgresUserRepository } from "./repositories/postgres-user-repository";
import { PostgresTaskRepository } from "./repositories/postgres-task-repository";
import { PostgresWorkspaceRepository } from "./repositories/postgres-workspace-repository";
import type { Database } from "./schema";

export type { Database } from "./schema";
export { createDatabase } from "./database";
export { migrateDown, migrateToLatest, type MigrationOutcome } from "./migrate";
export {
  PostgresBriefRepository,
  PostgresCampaignRepository,
  PostgresChannelConnectionRepository,
  PostgresContentItemRepository,
  PostgresProductRepository,
  PostgresSessionRepository,
  PostgresSocialProfileRepository,
  PostgresSubscriptionRepository,
  PostgresTaskRepository,
  PostgresUserRepository,
  PostgresWorkspaceRepository,
};

/** Every repository over one connection pool, for composition roots. */
export const createPostgresRepositories = (db: Kysely<Database>) => ({
  users: new PostgresUserRepository(db),
  sessions: new PostgresSessionRepository(db),
  subscriptions: new PostgresSubscriptionRepository(db),
  workspaces: new PostgresWorkspaceRepository(db),
  products: new PostgresProductRepository(db),
  briefs: new PostgresBriefRepository(db),
  campaigns: new PostgresCampaignRepository(db),
  tasks: new PostgresTaskRepository(db),
  contentItems: new PostgresContentItemRepository(db),
  channelConnections: new PostgresChannelConnectionRepository(db),
  socialProfiles: new PostgresSocialProfileRepository(db),
});
