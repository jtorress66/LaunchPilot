import { campaignId, productId, taskId, workspaceId } from "@launchpilot/domain";
import { aCampaign, aProduct, aTask, aUser, aWorkspace } from "@launchpilot/testing";
import { sql, type Kysely } from "kysely";
import { inject } from "vitest";
import { createDatabase, type Database } from "../../src/postgres";
import { campaignMapper } from "../../src/postgres/mappers/campaign-mapper";
import { productMapper } from "../../src/postgres/mappers/product-mapper";
import { taskMapper } from "../../src/postgres/mappers/task-mapper";
import { userMapper } from "../../src/postgres/mappers/user-mapper";
import { workspaceMapper } from "../../src/postgres/mappers/workspace-mapper";

export const connect = (): Kysely<Database> => createDatabase(inject("databaseUrl"));

export const truncateAll = async (db: Kysely<Database>): Promise<void> => {
  await sql`TRUNCATE users, sessions, subscriptions, workspaces, products, briefs, campaigns, tasks, content_items, channel_connections, social_profiles, launch_kits, submissions, directories, analytics_connections, weekly_reports CASCADE`.execute(
    db,
  );
};

/** How far up the ownership chain to create parent rows, so foreign keys stay enforced. */
export type ParentLevel = "none" | "users" | "workspaces" | "products" | "campaigns" | "tasks";
const order: readonly ParentLevel[] = [
  "none",
  "users",
  "workspaces",
  "products",
  "campaigns",
  "tasks",
];

/** Inserts the parents the shared contract fixtures reference (user_founder, ws_1/2, prod_1/2, camp_1/2, task_1). */
export const seedParents = async (db: Kysely<Database>, level: ParentLevel): Promise<void> => {
  const reaches = (target: ParentLevel) => order.indexOf(level) >= order.indexOf(target);
  if (reaches("users")) {
    await db.insertInto("users").values(userMapper.toRow(aUser())).execute();
  }
  if (reaches("workspaces")) {
    await db
      .insertInto("workspaces")
      .values(
        ["ws_1", "ws_2"].map((id) => workspaceMapper.toRow(aWorkspace({ id: workspaceId(id) }))),
      )
      .execute();
  }
  if (reaches("products")) {
    await db
      .insertInto("products")
      .values(
        ["prod_1", "prod_2"].map((id) => productMapper.toRow(aProduct({ id: productId(id) }))),
      )
      .execute();
  }
  if (reaches("campaigns")) {
    await db
      .insertInto("campaigns")
      .values(
        ["camp_1", "camp_2"].map((id) => campaignMapper.toRow(aCampaign({ id: campaignId(id) }))),
      )
      .execute();
  }
  if (reaches("tasks")) {
    await db
      .insertInto("tasks")
      .values(taskMapper.toRow(aTask({ id: taskId("task_1") })))
      .execute();
  }
};

/** A clean database with the given parents, for one test. */
export const resetWith = async (db: Kysely<Database>, level: ParentLevel): Promise<void> => {
  await truncateAll(db);
  await seedParents(db, level);
};
