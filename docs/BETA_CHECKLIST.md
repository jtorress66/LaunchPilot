# Nuvantre — Beta checklist (build step 11)

Each item links to the test, CI job or file that proves it. Items marked **owner** are settings on
the hosting side that code cannot prove; they must be done before inviting beta founders.

## Abuse and load

- [x] **Login, sign-up, AI drafting, account connections and webhooks are rate limited.**
  Policies: `packages/application/src/rate-limits.ts` (`test/rate-limits.test.ts`). Edge guard:
  `apps/web/src/server/rate-limit.ts` (`rate-limit.test.ts`), webhook 429:
  `apps/web/src/server/webhook-handler.test.ts`. E2E: `apps/web/e2e/hardening.spec.ts` (the 11th
  failed login waits, even with the right password).
- [x] **Counters hold under concurrency.** `RateLimiter` contract
  (`packages/testing/contracts/rate-limiter.contract.ts`) against in-memory and Postgres; 30
  concurrent consumes on a limit of 10 let exactly 10 through
  (`packages/adapters/test/postgres/hardening.int.test.ts`). Old counters are purged hourly
  (`apps/worker/src/jobs/purge-rate-limits-job.ts`).
- [x] **A second worker never double-publishes.** `JobLock` contract
  (`packages/testing/contracts/job-lock.contract.ts`), Postgres advisory locks
  (`hardening.int.test.ts`), and two workers on one database publish each due post once
  (`apps/worker/test/publish-due.int.test.ts`).

## Monitoring

- [x] **Errors are reported with context, secrets scrubbed.** `scrubSecrets`, JSON and Sentry
  reporters in `packages/adapters/src/monitoring/` (each with tests). Web: `instrumentation.ts`
  → `apps/web/src/server/request-error.test.ts`. Worker jobs: `apps/worker/src/jobs/logged-job.ts`.
- [x] **Every response has a request id.** `apps/web/src/middleware.test.ts`, `hardening.spec.ts`.
- [x] **Readiness check on the database.** `GET /api/health/ready`
  (`apps/web/src/server/readiness-handler.test.ts`, `hardening.spec.ts`); Postgres probe in
  `hardening.int.test.ts`. The worker heartbeat lists each job's last success.
- [ ] **owner:** set `SENTRY_DSN`, `APP_ENV=production` and `APP_VERSION` on web and worker, and
  point the host's health check at `/api/health/ready`.

## Audit log

- [x] **Founder-visible Activity log.** Domain entry and labels:
  `packages/domain/src/audit/audit-entry.ts`; `AuditTrail` contract
  (`packages/testing/contracts/audit-trail.contract.ts`) against in-memory and Postgres; each
  audited use case records the right entry and nothing on failure
  (`packages/application/test/audit.test.ts` and the use case tests). Page sentences:
  `apps/web/src/server/activity.test.ts`. E2E: approvals and publishing appear on `/app/activity`
  (`hardening.spec.ts`).

## Security

- [x] **Strict Content-Security-Policy, HSTS and frame protection.**
  `apps/web/src/server/security-headers.test.ts`, `middleware.test.ts`; no CSP violations across
  sign-up, brief, SEO connect, draft, approve and publish (`hardening.spec.ts`).
- [x] **Session cookie hardened.** `__Host-` prefix over https, older cookies still read
  (`apps/web/src/server/session-cookie.test.ts`, `middleware.test.ts`).
- [x] **No known high or critical vulnerabilities in production dependencies.** CI `security`
  job: `pnpm audit --audit-level high --prod` (Next.js 15.5.28, zod 4, postcss override).
- [x] **No secrets in the repository or its history.** CI `security` job: gitleaks over the full
  history with `.gitleaks.toml` (test fixtures with fake credentials allowed by path).

## Agent quality

- [x] **Eval thresholds in one place, guarded.** `evals/thresholds.json`, read by every suite;
  `apps/worker/src/eval/thresholds.test.ts` fails if a suite is missing or a threshold is lowered.
  `pnpm eval` writes `evals/results.json`, kept by CI as the `eval-results` artifact.

## Safety rules (since earlier steps)

- [x] **Nothing is published without the founder's approval.** `ContentItem` state machine tests
  (`packages/domain`), publish use case tests, and every publish E2E.
- [x] **Reddit, Hacker News and Indie Hackers stay draft-only.** Launch module tests and
  `apps/web/e2e/launch-community.spec.ts`.
- [x] **OAuth tokens and API keys are encrypted at rest and never logged.** Cipher and mapper tests
  in `packages/adapters`, and `scrubSecrets` on every error report.

## Operations

- [ ] **owner:** enable daily backups with point-in-time recovery on the production Postgres, and
  restore one backup into a scratch database once before the beta.
