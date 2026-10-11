import { campaignId, taskId, taskKinds, taskStatuses, type Task } from "@launchpilot/domain";
import type { TaskRow } from "../schema";
import { oneOf } from "./columns";

export const taskMapper = {
  toRow: (task: Task): TaskRow => ({
    id: task.id,
    campaign_id: task.campaignId,
    kind: task.kind,
    title: task.title,
    status: task.status,
  }),
  fromRow: (row: TaskRow): Task => ({
    id: taskId(row.id),
    campaignId: campaignId(row.campaign_id),
    kind: oneOf(taskKinds, row.kind, "tasks.kind"),
    title: row.title,
    status: oneOf(taskStatuses, row.status, "tasks.status"),
  }),
};
