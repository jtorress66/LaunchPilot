import {
  auditActions,
  workspaceId,
  type AuditActor,
  type AuditEntry,
  type AuditSubject,
  type WorkspaceId,
} from "@nuvantre/domain";
import type {
  AuditTrail,
  Clock,
  JobLock,
  RateLimitDecision,
  RateLimiter,
  RateLimitRule,
  ReadinessProbe,
} from "@nuvantre/ports";
import { sql, type Kysely } from "kysely";
import { oneOf, readJson, toJson } from "../mappers/columns";
import type { AuditEntryRow, Database } from "../schema";

/** Fixed windows aligned to the epoch; one atomic upsert per attempt, safe across instances. */
export class PostgresRateLimiter implements RateLimiter {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly clock: Clock,
  ) {}

  async consume(key: string, rule: RateLimitRule): Promise<RateLimitDecision> {
    const now = this.clock.now().getTime();
    const windowMs = rule.windowSeconds * 1000;
    const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
    const { count } = await this.db
      .insertInto("rate_limits")
      .values({ key, window_start: windowStart, count: 1 })
      .onConflict((conflict) =>
        conflict
          .columns(["key", "window_start"])
          .doUpdateSet({ count: sql<number>`rate_limits.count + 1` }),
      )
      .returning("count")
      .executeTakeFirstOrThrow();
    if (count <= rule.limit) return { allowed: true };
    const retryAfterMs = windowStart.getTime() + windowMs - now;
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  /** Removes counters of windows that started before `before`; the worker calls it hourly. */
  async purgeBefore(before: Date): Promise<number> {
    const result = await this.db
      .deleteFrom("rate_limits")
      .where("window_start", "<", before)
      .executeTakeFirst();
    return Number(result.numDeletedRows);
  }
}

const toEntry = (row: AuditEntryRow): AuditEntry => ({
  id: row.id,
  workspaceId: workspaceId(row.workspace_id),
  actor: readJson(row.actor) as AuditActor,
  action: oneOf(auditActions, row.action, "audit_entries.action"),
  subject: readJson(row.subject) as AuditSubject,
  at: row.at,
});

export class PostgresAuditTrail implements AuditTrail {
  constructor(private readonly db: Kysely<Database>) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.db
      .insertInto("audit_entries")
      .values({
        id: entry.id,
        workspace_id: entry.workspaceId,
        actor: toJson(entry.actor),
        action: entry.action,
        subject: toJson(entry.subject),
        at: entry.at,
      })
      .execute();
  }

  async listByWorkspace(
    id: WorkspaceId,
    page: { readonly before?: Date; readonly limit: number },
  ): Promise<readonly AuditEntry[]> {
    let query = this.db.selectFrom("audit_entries").selectAll().where("workspace_id", "=", id);
    if (page.before) query = query.where("at", "<", page.before);
    const rows = await query
      .orderBy("at", "desc")
      .orderBy("id", "desc")
      .limit(page.limit)
      .execute();
    return rows.map(toEntry);
  }
}

/**
 * Session advisory locks on one pinned connection: a second worker's try fails at once instead
 * of waiting, and the lock is released when the work ends or the connection drops.
 */
export class PostgresJobLock implements JobLock {
  constructor(private readonly db: Kysely<Database>) {}

  runExclusive(name: string, work: () => Promise<void>): Promise<"ran" | "skipped"> {
    return this.db.connection().execute(async (connection) => {
      const { rows } = await sql<{
        locked: boolean;
      }>`SELECT pg_try_advisory_lock(hashtext(${name})) AS locked`.execute(connection);
      if (!rows[0]?.locked) return "skipped";
      try {
        await work();
        return "ran";
      } finally {
        await sql`SELECT pg_advisory_unlock(hashtext(${name}))`.execute(connection);
      }
    });
  }
}

/** Readiness: the database answers a trivial query within the timeout. */
export class PostgresReadinessProbe implements ReadinessProbe {
  readonly name = "database";

  constructor(
    private readonly db: Kysely<Database>,
    private readonly timeoutMs = 2_000,
  ) {}

  async check(): Promise<
    { readonly ready: true } | { readonly ready: false; readonly reason: string }
  > {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => {
        resolve("timeout");
      }, this.timeoutMs);
    });
    try {
      const answer = await Promise.race([sql`SELECT 1`.execute(this.db), timeout]);
      if (answer === "timeout")
        return { ready: false, reason: "The database did not answer in time" };
      return { ready: true };
    } catch {
      // The driver's message can include the host or user; the reason stays generic.
      return { ready: false, reason: "The database could not be reached" };
    } finally {
      clearTimeout(timer);
    }
  }
}
