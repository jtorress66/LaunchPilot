import { aTask } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { taskMapper } from "./task-mapper";

describe("taskMapper", () => {
  it("round-trips a task", () => {
    const task = aTask({ kind: "weekly_report" });
    const row = taskMapper.toRow(task);
    expect(row).toMatchObject({ campaign_id: "camp_1", kind: "weekly_report", status: "todo" });
    expect(taskMapper.fromRow(row)).toEqual(task);
  });

  it("round-trips the keyword an SEO task targets", () => {
    const task = {
      ...aTask(),
      seo: { keyword: "seo for saas", monthlySearches: 90, difficulty: 7 },
    };
    const row = taskMapper.toRow(task);
    expect(row).toMatchObject({
      seo_keyword: "seo for saas",
      seo_monthly_searches: 90,
      seo_difficulty: 7,
    });
    expect(taskMapper.fromRow(row)).toEqual(task);
  });

  it("stores no SEO columns for other tasks", () => {
    expect(taskMapper.toRow(aTask())).toMatchObject({
      seo_keyword: null,
      seo_monthly_searches: null,
      seo_difficulty: null,
    });
  });

  it("refuses an unknown kind", () => {
    const row = { ...taskMapper.toRow(aTask()), kind: "podcast" };
    expect(() => taskMapper.fromRow(row)).toThrow(/tasks\.kind/);
  });

  it("refuses an unknown status", () => {
    const row = { ...taskMapper.toRow(aTask()), status: "cancelled" };
    expect(() => taskMapper.fromRow(row)).toThrow(/tasks\.status/);
  });
});
