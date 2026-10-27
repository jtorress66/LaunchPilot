import {
  createDatabase,
  createPostgresRepositories,
  migrateDown,
  migrateToLatest,
} from "@nuvantre/adapters";
import { PublishDueContent, PublisherRegistry } from "@nuvantre/application";
import { contentItemId } from "@nuvantre/domain";
import {
  aCampaign,
  aContentItem,
  aProduct,
  aTask,
  aUser,
  aWorkspace,
  FakePublisherProvider,
  FixedClock,
} from "@nuvantre/testing";
import { afterAll, beforeAll, describe, expect, it, inject } from "vitest";
import { createPublishDueJob } from "../src/jobs/publish-due-job";

const db = createDatabase(inject("databaseUrl"));
const repos = createPostgresRepositories(db);
const clock = new FixedClock(new Date("2026-06-01T12:00:00.000Z"));

beforeAll(async () => {
  // A clean schema, so only this test's scheduled items are due.
  await migrateDown(db);
  await migrateToLatest(db);
  await repos.users.save(aUser());
  await repos.workspaces.save(aWorkspace());
  await repos.products.save(aProduct());
  await repos.campaigns.save(aCampaign());
  const task = aTask();
  const started = { ...task, status: "in_progress" as const };
  await repos.tasks.save(started);
});

afterAll(async () => {
  await db.destroy();
});

describe("publish-due job on Postgres", () => {
  it("publishes due posts, records retries, and persists every outcome", async () => {
    const scheduled = aContentItem({ channel: "x", status: "scheduled" });
    const due = (id: string, minutesAgo: number) => ({
      ...scheduled,
      id: contentItemId(id),
      publishAt: new Date(clock.now().getTime() - minutesAgo * 60_000),
    });
    await repos.contentItems.save(due("item_due", 5));
    await repos.contentItems.save(due("item_flaky", 10));
    await repos.contentItems.save({ ...due("item_later", 0), publishAt: new Date("2026-06-02") });

    const x = new FakePublisherProvider("x", clock).connect(scheduled.productId);
    x.publisher.failNext({ code: "unavailable", message: "Busy", retryable: true });
    const lines: string[] = [];
    const job = createPublishDueJob({
      publishDue: new PublishDueContent({
        contentItems: repos.contentItems,
        products: repos.products,
        subscriptions: repos.subscriptions,
        tasks: repos.tasks,
        publishers: new PublisherRegistry([x]),
        clock,
      }),
      log: (line) => lines.push(line),
    });

    await job.run();

    // The earliest (flaky) one is tried first and fails; the other publishes.
    expect(lines).toEqual([
      JSON.stringify({
        event: "worker.publish_due",
        published: 1,
        retrying: 1,
        failed: 0,
        held: 0,
      }),
    ]);
    expect(await repos.contentItems.findById(contentItemId("item_flaky"))).toMatchObject({
      status: "scheduled",
      publishAttempts: 1,
    });
    const published = await repos.contentItems.findById(contentItemId("item_due"));
    expect(published).toMatchObject({
      status: "published",
      publication: { externalUrl: "https://example.com/x/item_due" },
    });
    expect((await repos.tasks.findById(scheduled.taskId))?.status).toBe("done");
    expect((await repos.contentItems.findById(contentItemId("item_later")))?.status).toBe(
      "scheduled",
    );

    await job.run();
    expect((await repos.contentItems.findById(contentItemId("item_flaky")))?.status).toBe(
      "published",
    );
  });
});
