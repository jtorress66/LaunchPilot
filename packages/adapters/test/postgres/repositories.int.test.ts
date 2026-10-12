import {
  describeChannelConnectionRepositoryContract,
  describeBriefRepositoryContract,
  describeCampaignRepositoryContract,
  describeContentItemRepositoryContract,
  describeProductRepositoryContract,
  describeSessionRepositoryContract,
  describeSocialProfileRepositoryContract,
  describeSubscriptionRepositoryContract,
  describeUserRepositoryContract,
  describeTaskRepositoryContract,
  describeWorkspaceRepositoryContract,
} from "@launchpilot/testing/contracts";
import { contentItemId, taskId, workspaceId } from "@launchpilot/domain";
import { aContentItem, aTask } from "@launchpilot/testing";
import { afterAll, describe, expect, it } from "vitest";
import {
  createPostgresRepositories,
  PostgresBriefRepository,
  PostgresCampaignRepository,
  PostgresChannelConnectionRepository,
  PostgresContentItemRepository,
  PostgresProductRepository,
  PostgresSessionRepository,
  PostgresSocialProfileRepository,
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

describeChannelConnectionRepositoryContract("PostgresChannelConnectionRepository", async () => {
  await resetWith(db, "products");
  return new PostgresChannelConnectionRepository(db);
});

describeSocialProfileRepositoryContract("PostgresSocialProfileRepository", async () => {
  await resetWith(db, "products");
  return new PostgresSocialProfileRepository(db);
});

describe("PostgresContentItemRepository", () => {
  it("lists due items earliest publish time first", async () => {
    await resetWith(db, "tasks");
    const repo = new PostgresContentItemRepository(db);
    const base = aContentItem({ id: contentItemId("item_late"), status: "scheduled" });
    const late = { ...base, publishAt: new Date("2026-05-02T00:00:00.000Z") };
    const early = {
      ...base,
      id: contentItemId("item_early"),
      publishAt: new Date("2026-05-01T00:00:00.000Z"),
    };
    await repo.save(late);
    await repo.save(early);
    expect((await repo.listByStatus("scheduled")).map((i) => i.id)).toEqual([
      "item_early",
      "item_late",
    ]);
  });
});

describe("PostgresTaskRepository", () => {
  it("stores the keyword an SEO task targets", async () => {
    await resetWith(db, "campaigns");
    const repo = new PostgresTaskRepository(db);
    const seo = { keyword: "cookieless analytics", monthlySearches: 480, difficulty: 12 };
    const task = { ...aTask({ id: taskId("task_seo") }), seo };
    await repo.save(task);
    expect(await repo.findById(task.id)).toEqual(task);
  });
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
      "channelConnections",
      "contentItems",
      "products",
      "sessions",
      "socialProfiles",
      "subscriptions",
      "tasks",
      "users",
      "workspaces",
    ]);
  });
});
