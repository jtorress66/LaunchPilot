// The weekly loop on real Postgres with the offline agents: Monday 07:00 UTC, one product with the
// autopilot on and an approved brief → a planned campaign and every item waiting in review.
import {
  createDatabase,
  createPostgresRepositories,
  migrateDown,
  migrateToLatest,
} from "@launchpilot/adapters";
import { enableAutopilot } from "@launchpilot/domain";
import { aBrief, aProduct, aUser, aWorkspace, FixedClock } from "@launchpilot/testing";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import type { LoopConfig, PublisherConfig } from "../src/config";
import { createWeeklyLoop } from "../src/container";

const monday = new Date("2026-10-19T07:00:00.000Z");
const publisher: PublisherConfig = {
  connectionString: inject("databaseUrl"),
  tokenEncryptionKey: Buffer.alloc(32, 3).toString("base64"),
  allowPrivateNetwork: false,
  intervalMs: 60_000,
  zernio: { apiKey: "sk_unused", baseUrl: null },
};
const offline: LoopConfig = {
  intervalMs: 3_600_000,
  claude: null,
  agents: {
    strategist: "template",
    reviewer: "template",
    articleWriter: "template",
    socialWriter: "template",
  },
  keywords: { kind: "offline" },
};

const db = createDatabase(inject("databaseUrl"));
const repos = createPostgresRepositories(db);
const clock = new FixedClock(monday);
const weekly = createWeeklyLoop(publisher, offline, clock);
const product = enableAutopilot(aProduct(), new Date("2026-10-12T09:00:00.000Z"));

beforeAll(async () => {
  await migrateDown(db);
  await migrateToLatest(db);
  await repos.users.save(aUser());
  await repos.workspaces.save(aWorkspace());
  await repos.products.save(product);
  await repos.briefs.save(aBrief({ status: "approved", productId: product.id }));
});

afterAll(async () => {
  await weekly.close();
  await db.destroy();
});

describe("weekly loop on Postgres", () => {
  it("plans, drafts and reviews the week, leaving every item in review", async () => {
    expect(await weekly.runDue.execute()).toEqual({ ran: 1, skipped: 0 });

    const run = await repos.autopilotRuns.findByProductAndWeek(
      product.id,
      new Date("2026-10-19T00:00:00.000Z"),
    );
    expect(run?.outcome).toMatchObject({ kind: "completed", summary: { failed: 0 } });
    const items = await repos.contentItems.listByProduct(product.id);
    expect(items.length).toBeGreaterThan(0);
    expect(run?.outcome).toMatchObject({ summary: { drafted: items.length } });
    for (const item of items) {
      expect(item.status).toBe("in_review");
      expect(item.approval).toBeNull();
      expect(item.agentReview).not.toBeNull();
    }
    expect(new Set(items.map((i) => i.channel))).toEqual(new Set(["blog", "x", "linkedin"]));
  });

  it("does not run the same week twice", async () => {
    const before = (await repos.contentItems.listByProduct(product.id)).length;
    expect(await weekly.runDue.execute()).toEqual({ ran: 0, skipped: 1 });
    expect(await repos.contentItems.listByProduct(product.id)).toHaveLength(before);
  });
});
