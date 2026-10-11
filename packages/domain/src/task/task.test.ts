import { describe, expect, it } from "vitest";
import { campaignId, taskId } from "../shared/ids";
import { createTask, transitionTask, type Task, type TaskEvent } from "./task";

const todo = (): Task => {
  const result = createTask({
    id: taskId("task_1"),
    campaignId: campaignId("camp_1"),
    kind: "seo_article",
    title: "Write 'best analytics for SaaS' article",
  });
  if (!result.ok) throw new Error("setup failed");
  return result.value;
};

const run = (task: Task, ...events: TaskEvent[]): Task =>
  events.reduce((current, event) => {
    const next = transitionTask(current, event);
    if (!next.ok) throw new Error(next.error.message);
    return next.value;
  }, task);

describe("task", () => {
  it("is created as todo", () => {
    expect(todo()).toEqual({
      id: "task_1",
      campaignId: "camp_1",
      kind: "seo_article",
      title: "Write 'best analytics for SaaS' article",
      status: "todo",
    });
  });

  it("rejects an empty title", () => {
    const result = createTask({
      id: taskId("task_1"),
      campaignId: campaignId("camp_1"),
      kind: "weekly_report",
      title: "",
    });
    expect(result.ok).toBe(false);
  });

  it("moves from todo to in progress to done", () => {
    expect(run(todo(), "start", "complete").status).toBe("done");
  });

  it("can be paused back to todo", () => {
    expect(run(todo(), "start", "pause").status).toBe("todo");
  });

  it("can be blocked and unblocked", () => {
    const blocked = run(todo(), "start", "block");
    expect(blocked.status).toBe("blocked");
    expect(run(blocked, "unblock").status).toBe("todo");
  });

  it("is final once done", () => {
    const done = run(todo(), "start", "complete");
    const result = transitionTask(done, "start");
    expect(result.ok ? undefined : result.error.code).toBe("invalid_transition");
  });
});
