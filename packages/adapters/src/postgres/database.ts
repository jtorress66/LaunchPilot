import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { Database } from "./schema";

/** The only place a connection pool is created. Call `destroy()` on shutdown. */
export const createDatabase = (connectionString: string, maxConnections = 10): Kysely<Database> =>
  new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max: maxConnections }) }),
  });
