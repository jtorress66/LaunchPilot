import {
  describeAuditTrailContract,
  describeJobLockContract,
  describeRateLimiterContract,
} from "../contracts";
import { FixedClock, InMemoryAuditTrail, InMemoryJobLock, InMemoryRateLimiter } from "../src";

describeRateLimiterContract("InMemoryRateLimiter", () => {
  const clock = new FixedClock(new Date("2026-10-28T09:00:00.000Z"));
  return { limiter: new InMemoryRateLimiter(clock), clock };
});

describeAuditTrailContract("InMemoryAuditTrail", () => new InMemoryAuditTrail());

describeJobLockContract("InMemoryJobLock", () => {
  // Two "workers" in one process share the held set, as two processes share a database.
  const held = new Set<string>();
  return { first: new InMemoryJobLock(held), second: new InMemoryJobLock(held) };
});
