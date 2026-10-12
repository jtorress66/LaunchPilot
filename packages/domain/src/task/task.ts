import { map, type Result } from "../result";
import type { DomainError } from "../shared/errors";
import type { CampaignId, TaskId } from "../shared/ids";
import { applyTransition, defineTransitions } from "../shared/state-machine";
import { nonEmptyText } from "../shared/text";

export const taskKinds = [
  "seo_article",
  "social_post",
  "launch_submission",
  "weekly_report",
] as const;
export type TaskKind = (typeof taskKinds)[number];
export const taskStatuses = ["todo", "in_progress", "blocked", "done"] as const;
export type TaskStatus = (typeof taskStatuses)[number];
export type TaskEvent = "start" | "pause" | "complete" | "block" | "unblock";

/** The keyword an SEO article targets, with the metrics it was chosen on. */
export interface SeoTarget {
  readonly keyword: string;
  readonly monthlySearches: number;
  readonly difficulty: number;
}

export interface Task {
  readonly id: TaskId;
  readonly campaignId: CampaignId;
  readonly kind: TaskKind;
  readonly title: string;
  readonly status: TaskStatus;
  readonly seo: SeoTarget | null;
}

const machine = defineTransitions<TaskStatus, TaskEvent>({
  todo: { start: "in_progress", block: "blocked" },
  in_progress: { pause: "todo", complete: "done", block: "blocked" },
  blocked: { unblock: "todo" },
  done: {},
});

export const createTask = (input: {
  id: TaskId;
  campaignId: CampaignId;
  kind: TaskKind;
  title: string;
  seo?: SeoTarget;
}): Result<Task, DomainError> =>
  map(nonEmptyText(input.title, { field: "Task title", max: 200 }), (title) => ({
    id: input.id,
    campaignId: input.campaignId,
    kind: input.kind,
    title,
    status: "todo" as const,
    seo: input.seo ?? null,
  }));

export const transitionTask = (task: Task, event: TaskEvent): Result<Task, DomainError> =>
  map(applyTransition(machine, task.status, event), (status) => ({ ...task, status }));
