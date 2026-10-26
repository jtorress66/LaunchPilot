import type { Email, User, UserId } from "@nuvantre/domain";
import type { UserRepository } from "@nuvantre/ports";
import { sql, type Kysely } from "kysely";
import { userMapper } from "../mappers/user-mapper";
import type { Database } from "../schema";
import { upsert } from "../upsert";

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: UserId): Promise<User | undefined> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row && userMapper.fromRow(row);
  }

  async findByEmail(email: Email): Promise<User | undefined> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where(sql<string>`lower(email)`, "=", email.toLowerCase())
      .executeTakeFirst();
    return row && userMapper.fromRow(row);
  }

  save(user: User): Promise<void> {
    return upsert(this.db, "users", userMapper.toRow(user));
  }
}
