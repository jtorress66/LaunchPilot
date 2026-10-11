import { aTask } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { taskMapper } from "./task-mapper";

describe("taskMapper", () => {
  it("round-trips a task", () => {
    const task = aTask({ kind: "weekly_report" });
    const row = taskMapper.toRow(task);
    expect(row).toMatchObject({ campaign_id: "camp_1", kind: "weekly_report", status: "todo" });
    expect(taskMapper.fromRow(row)).toEqual(task);
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
