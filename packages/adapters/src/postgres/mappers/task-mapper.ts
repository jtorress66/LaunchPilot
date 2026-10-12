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
    seo_keyword: task.seo?.keyword ?? null,
    seo_monthly_searches: task.seo?.monthlySearches ?? null,
    seo_difficulty: task.seo?.difficulty ?? null,
  }),
  fromRow: (row: TaskRow): Task => ({
    id: taskId(row.id),
    campaignId: campaignId(row.campaign_id),
    kind: oneOf(taskKinds, row.kind, "tasks.kind"),
    title: row.title,
    status: oneOf(taskStatuses, row.status, "tasks.status"),
    seo:
      row.seo_keyword === null
        ? null
        : {
            keyword: row.seo_keyword,
            monthlySearches: row.seo_monthly_searches ?? 0,
            difficulty: row.seo_difficulty ?? 0,
          },
  }),
};
