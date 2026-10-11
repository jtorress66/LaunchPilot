import {
  describeBriefRepositoryContract,
  describeCampaignRepositoryContract,
  describeContentItemRepositoryContract,
  describeProductRepositoryContract,
  describeSessionRepositoryContract,
  describeSubscriptionRepositoryContract,
  describeUserRepositoryContract,
  describeTaskRepositoryContract,
  describeWorkspaceRepositoryContract,
} from "@launchpilot/testing/contracts";
import { workspaceId } from "@launchpilot/domain";
import { aContentItem } from "@launchpilot/testing";
import { afterAll, describe, expect, it } from "vitest";
import {
  createPostgresRepositories,
  PostgresBriefRepository,
  PostgresCampaignRepository,
  PostgresContentItemRepository,
  PostgresProductRepository,
  PostgresSessionRepository,
  PostgresSubscriptionRepository,
  PostgresUserRepository,
  PostgresTaskRepository,
  PostgresWorkspaceRepository,
} from "../../src/postgres";
import { connect, resetWith } from "./test-db";

// Build step 3 gate: the same contract suites the in-memory fakes pass, against real Postgres.
const db = connect();
afterAll(async () => {
  await db.destroy();
});

describeWorkspaceRepositoryContract("PostgresWorkspaceRepository", async () => {
  await resetWith(db, "users");
  return new PostgresWorkspaceRepository(db);
});

describeUserRepositoryContract("PostgresUserRepository", async () => {
  await resetWith(db, "none");
  return new PostgresUserRepository(db);
});

describeSessionRepositoryContract("PostgresSessionRepository", async () => {
  await resetWith(db, "users");
  return new PostgresSessionRepository(db);
});

describeSubscriptionRepositoryContract("PostgresSubscriptionRepository", async () => {
  await resetWith(db, "workspaces");
  return new PostgresSubscriptionRepository(db);
});

describeProductRepositoryContract("PostgresProductRepository", async () => {
  await resetWith(db, "workspaces");
  return new PostgresProductRepository(db);
});

describeBriefRepositoryContract("PostgresBriefRepository", async () => {
  await resetWith(db, "products");
  return new PostgresBriefRepository(db);
});

describeCampaignRepositoryContract("PostgresCampaignRepository", async () => {
  await resetWith(db, "products");
  return new PostgresCampaignRepository(db);
});

describeTaskRepositoryContract("PostgresTaskRepository", async () => {
  await resetWith(db, "campaigns");
  return new PostgresTaskRepository(db);
});

describeContentItemRepositoryContract("PostgresContentItemRepository", async () => {
  await resetWith(db, "tasks");
  return new PostgresContentItemRepository(db);
});

describe("createPostgresRepositories", () => {
  it("builds every repository over one connection pool", async () => {
    await resetWith(db, "tasks");
    const repos = createPostgresRepositories(db);
    const item = aContentItem();
    await repos.contentItems.save(item);
    expect(await repos.contentItems.findById(item.id)).toEqual(item);
    expect(await repos.workspaces.findById(workspaceId("ws_1"))).toBeDefined();
    expect(Object.keys(repos).sort()).toEqual([
      "briefs",
      "campaigns",
      "contentItems",
      "products",
      "sessions",
      "subscriptions",
      "tasks",
      "users",
      "workspaces",
    ]);
  });
});
