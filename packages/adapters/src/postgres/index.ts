import type { Kysely } from "kysely";
import { PostgresBriefRepository } from "./repositories/postgres-brief-repository";
import { PostgresCampaignRepository } from "./repositories/postgres-campaign-repository";
import { PostgresChannelConnectionRepository } from "./repositories/postgres-channel-connection-repository";
import { PostgresContentItemRepository } from "./repositories/postgres-content-item-repository";
import { PostgresProductRepository } from "./repositories/postgres-product-repository";
import { PostgresSessionRepository } from "./repositories/postgres-session-repository";
import { PostgresSocialProfileRepository } from "./repositories/postgres-social-profile-repository";
import {
  PostgresDirectoryCatalog,
  PostgresLaunchKitRepository,
  PostgresSubmissionRepository,
} from "./repositories/postgres-launch-repositories";
import { PostgresSubscriptionRepository } from "./repositories/postgres-subscription-repository";
import { PostgresUserRepository } from "./repositories/postgres-user-repository";
import { PostgresTaskRepository } from "./repositories/postgres-task-repository";
import { PostgresWorkspaceRepository } from "./repositories/postgres-workspace-repository";
import {
  PostgresAnalyticsConnectionRepository,
  PostgresWeeklyReportRepository,
} from "./repositories/postgres-analytics-repositories";
import { PostgresAutopilotRunRepository } from "./repositories/postgres-autopilot-run-repository";
import {
  PostgresBrandingRepository,
  PostgresInvitationRepository,
  PostgresMembershipRepository,
  PostgresReportRecipientRepository,
} from "./repositories/postgres-agency-repositories";
import type { Database } from "./schema";

export type { Database } from "./schema";
export { createDatabase } from "./database";
export {
  PostgresAuditTrail,
  PostgresJobLock,
  PostgresRateLimiter,
  PostgresReadinessProbe,
} from "./repositories/postgres-hardening";
export { migrateDown, migrateToLatest, type MigrationOutcome } from "./migrate";
export { syncDirectories, type DirectorySyncOutcome } from "./sync-directories";
export { loadSeedDirectories } from "./seeds/load-seed";
export { parseSeedDirectories } from "./seeds/parse-seed";
export {
  PostgresBrandingRepository,
  PostgresInvitationRepository,
  PostgresMembershipRepository,
  PostgresReportRecipientRepository,
  PostgresAutopilotRunRepository,
  PostgresAnalyticsConnectionRepository,
  PostgresWeeklyReportRepository,
  PostgresDirectoryCatalog,
  PostgresLaunchKitRepository,
  PostgresSubmissionRepository,
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
  directories: new PostgresDirectoryCatalog(db),
  launchKits: new PostgresLaunchKitRepository(db),
  submissions: new PostgresSubmissionRepository(db),
  analyticsConnections: new PostgresAnalyticsConnectionRepository(db),
  weeklyReports: new PostgresWeeklyReportRepository(db),
  autopilotRuns: new PostgresAutopilotRunRepository(db),
  memberships: new PostgresMembershipRepository(db),
  invitations: new PostgresInvitationRepository(db),
  branding: new PostgresBrandingRepository(db),
  reportRecipients: new PostgresReportRecipientRepository(db),
});
