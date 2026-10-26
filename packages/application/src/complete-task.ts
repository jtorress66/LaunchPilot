import { transitionTask, type ContentItem } from "@nuvantre/domain";
import type { TaskRepository } from "@nuvantre/ports";

/** Marks the task behind a published item as done, if it is still in progress. */
export const completeTaskOf = async (tasks: TaskRepository, item: ContentItem): Promise<void> => {
  const task = await tasks.findById(item.taskId);
  if (task?.status !== "in_progress") return;
  const done = transitionTask(task, "complete");
  if (done.ok) await tasks.save(done.value);
};
