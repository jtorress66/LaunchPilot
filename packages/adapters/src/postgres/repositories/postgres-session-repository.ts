import type { Session } from "@nuvantre/domain";
import type { SessionRepository } from "@nuvantre/ports";
import type { Kysely } from "kysely";
import { sessionMapper } from "../mappers/session-mapper";
import type { Database } from "../schema";

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByToken(token: string): Promise<Session | undefined> {
    const row = await this.db
      .selectFrom("sessions")
      .selectAll()
      .where("token_hash", "=", sessionMapper.hashToken(token))
      .executeTakeFirst();
    return row && sessionMapper.fromRow(row, token);
  }

  async save(session: Session): Promise<void> {
    const row = sessionMapper.toRow(session);
    await this.db
      .insertInto("sessions")
      .values(row)
      .onConflict((conflict) => conflict.column("token_hash").doUpdateSet(row))
      .execute();
  }

  async delete(token: string): Promise<void> {
    await this.db
      .deleteFrom("sessions")
      .where("token_hash", "=", sessionMapper.hashToken(token))
      .execute();
  }
}
