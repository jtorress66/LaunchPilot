import type { UserId, Workspace, WorkspaceId } from "@nuvantre/domain";
import type { WorkspaceRepository } from "@nuvantre/ports";
import type { Kysely } from "kysely";
import { workspaceMapper } from "../mappers/workspace-mapper";
import type { Database } from "../schema";
import { upsert } from "../upsert";

export class PostgresWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: WorkspaceId): Promise<Workspace | undefined> {
    const row = await this.db
      .selectFrom("workspaces")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row && workspaceMapper.fromRow(row);
  }

  save(workspace: Workspace): Promise<void> {
    return upsert(this.db, "workspaces", workspaceMapper.toRow(workspace));
  }

  async findByOwner(ownerId: UserId): Promise<Workspace | undefined> {
    const row = await this.db
      .selectFrom("workspaces")
      .selectAll()
      .where("owner_id", "=", ownerId)
      .orderBy("created_at")
      .limit(1)
      .executeTakeFirst();
    return row && workspaceMapper.fromRow(row);
  }
}
