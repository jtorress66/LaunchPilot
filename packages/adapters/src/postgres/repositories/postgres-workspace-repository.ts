import type { Workspace, WorkspaceId } from "@launchpilot/domain";
import type { WorkspaceRepository } from "@launchpilot/ports";
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
}
