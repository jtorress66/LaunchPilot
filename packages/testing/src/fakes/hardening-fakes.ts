import type { AuditEntry, WorkspaceId } from "@nuvantre/domain";
import type {
  AuditTrail,
  Clock,
  ErrorContext,
  ErrorReporter,
  JobLock,
  RateLimitDecision,
  RateLimiter,
  RateLimitRule,
  ReadinessProbe,
} from "@nuvantre/ports";

/** Fixed windows aligned to the epoch, as the Postgres limiter counts them. */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly counts = new Map<string, number>();

  constructor(private readonly clock: Clock) {}

  consume(key: string, rule: RateLimitRule): Promise<RateLimitDecision> {
    const now = this.clock.now().getTime();
    const windowMs = rule.windowSeconds * 1000;
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const slot = `${key}@${String(windowStart)}`;
    const count = (this.counts.get(slot) ?? 0) + 1;
    this.counts.set(slot, count);
    if (count <= rule.limit) return Promise.resolve({ allowed: true });
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
    return Promise.resolve({ allowed: false, retryAfterSeconds });
  }
}

export class InMemoryAuditTrail implements AuditTrail {
  readonly entries: AuditEntry[] = [];

  record(entry: AuditEntry): Promise<void> {
    this.entries.push(structuredClone(entry));
    return Promise.resolve();
  }

  listByWorkspace(
    workspaceId: WorkspaceId,
    page: { readonly before?: Date; readonly limit: number },
  ): Promise<readonly AuditEntry[]> {
    const before = page.before?.getTime() ?? Number.POSITIVE_INFINITY;
    return Promise.resolve(
      this.entries
        .filter((e) => e.workspaceId === workspaceId && e.at.getTime() < before)
        .sort((a, b) => b.at.getTime() - a.at.getTime() || b.id.localeCompare(a.id))
        .slice(0, page.limit)
        .map((e) => structuredClone(e)),
    );
  }
}

/** Shares `held` between instances to stand in for one database's advisory locks. */
export class InMemoryJobLock implements JobLock {
  constructor(private readonly held = new Set<string>()) {}

  async runExclusive(name: string, work: () => Promise<void>): Promise<"ran" | "skipped"> {
    if (this.held.has(name)) return "skipped";
    this.held.add(name);
    try {
      await work();
      return "ran";
    } finally {
      this.held.delete(name);
    }
  }
}

/** Remembers what was reported, for tests to assert on. */
export class FakeErrorReporter implements ErrorReporter {
  readonly reports: { error: unknown; context: ErrorContext }[] = [];

  report(error: unknown, context: ErrorContext): void {
    this.reports.push({ error, context });
  }
}

export class FakeReadinessProbe implements ReadinessProbe {
  private failure: string | null = null;

  constructor(readonly name = "database") {}

  failWith(reason: string): this {
    this.failure = reason;
    return this;
  }

  check() {
    return Promise.resolve(
      this.failure === null
        ? ({ ready: true } as const)
        : ({ ready: false, reason: this.failure } as const),
    );
  }
}
