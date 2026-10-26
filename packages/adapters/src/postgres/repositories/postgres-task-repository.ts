import type { CampaignId, Task, TaskId } from "@nuvantre/domain";
import type { TaskRepository } from "@nuvantre/ports";
import type { Kysely } from "kysely";
import { taskMapper } from "../mappers/task-mapper";
import type { Database } from "../schema";
import { upsert } from "../upsert";

export class PostgresTaskRepository implements TaskRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: TaskId): Promise<Task | undefined> {
    const row = await this.db
      .selectFrom("tasks")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row && taskMapper.fromRow(row);
  }

  save(task: Task): Promise<void> {
    return upsert(this.db, "tasks", taskMapper.toRow(task));
  }

  async listByCampaign(campaignId: CampaignId): Promise<readonly Task[]> {
    const rows = await this.db
      .selectFrom("tasks")
      .selectAll()
      .where("campaign_id", "=", campaignId)
      .orderBy("id")
      .execute();
    return rows.map(taskMapper.fromRow);
  }
}
