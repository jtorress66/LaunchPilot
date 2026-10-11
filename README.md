# LaunchPilot

LaunchPilot is an AI marketing app for SaaS founders. It reads a founder's SaaS, writes a Product
Brief, and runs SEO content, launches/directories, social posting and analytics on a weekly loop.
The founder approves everything before it is published.

> **Status:** build step 1 (Foundation) of 11. See [`docs/BUILD_STEPS.md`](docs/BUILD_STEPS.md).
> Contributor and agent rules live in [`CLAUDE.md`](CLAUDE.md).

## Prerequisites

- Node.js 22 (`nvm use` reads `.nvmrc`)
- pnpm 10 (`corepack enable` picks the version from `package.json`)
- Docker, for the local database and integration tests

## Getting started

```bash
pnpm install
pnpm dev            # web on http://localhost:3000 + worker heartbeat
```

- Landing page: <http://localhost:3000>
- Health check: <http://localhost:3000/api/health>

### Database

```bash
cp .env.example .env             # DATABASE_URL for the local container
pnpm db:up                       # Postgres 16 via docker compose
export $(grep -v '^#' .env | xargs)
pnpm db:migrate                  # apply pending migrations (safe to re-run)
```

The schema lives in `packages/adapters/src/postgres/migrations/` as ordered, immutable TypeScript
migrations (Kysely). Besides foreign keys and value checks, the database itself refuses rows that
break the product safety rules: approved/scheduled/published content without a founder approval, a
scheduled item without a publish time, and any scheduled or published item on a draft-only channel.

## Commands

| Command           | What it does                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm test`       | Unit + contract tests with coverage thresholds (Vitest)                                        |
| `pnpm test:int`   | Integration tests + repository contracts against real Postgres (Testcontainers), with coverage |
| `pnpm db:up`      | Start the local Postgres container                                                             |
| `pnpm db:migrate` | Apply pending migrations to `DATABASE_URL`                                                     |
| `pnpm test:e2e`   | Playwright E2E (desktop + mobile); builds and starts the web app                               |
| `pnpm typecheck`  | `tsc --noEmit` in every package                                                                |
| `pnpm lint`       | ESLint, zero warnings allowed                                                                  |
| `pnpm format`     | Prettier write (`pnpm format:check` in CI)                                                     |
| `pnpm eval`       | LLM evals (none yet; arrive with the agents)                                                   |
| `pnpm build`      | Production build of the web app                                                                |

The pre-merge gate is `pnpm test && pnpm typecheck && pnpm lint`. CI
(`.github/workflows/ci.yml`) also runs integration and E2E tests.

## Architecture

Ports and adapters. Dependencies point inward only:

```
domain  ←  ports  ←  application  ←  agents / adapters  ←  apps (web, worker)
```

| Path                   | Responsibility                                                                                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain`      | Entities (Workspace, Product, Brief, Campaign, Task, ContentItem), value objects, the `ContentItem` state machine, `Result<T, E>`; no I/O, no frameworks                                                  |
| `packages/ports`       | Interfaces only: `Clock`, `IdGenerator`, `TokenCipher`, `LlmClient`, `ContentDrafter`, `ContentReviewer`, `CampaignPlanner`, `SiteCrawler`, `KeywordProvider`, `MetricsSource`, `Publisher`, repositories |
| `packages/application` | Use cases that orchestrate domain rules and ports                                                                                                                                                         |
| `packages/agents`      | AI agents; implement agent ports, depend on domain and ports only                                                                                                                                         |
| `packages/adapters`    | Port implementations (e.g. `SystemClock`)                                                                                                                                                                 |
| `packages/testing`     | A fake for every port, entity fixtures (`aContentItem({ status })`…), shared contract suites                                                                                                              |
| `apps/web`             | Next.js UI + thin API routes; wiring in `src/container.ts`                                                                                                                                                |
| `apps/worker`          | Background jobs; wiring in `src/container.ts`                                                                                                                                                             |

### Content approval lifecycle

```
draft → in_review → approved → scheduled → published
          │  └→ rejected        │  ↑ unschedule   └→ failed → retry → scheduled
          └→ draft (changes requested)
edit (from approved / scheduled / rejected / failed) → draft, clearing approval
```

- Only a founder can approve; agents can draft, review and request changes.
- Reddit, Hacker News, Indie Hackers, Product Hunt and directory content can be approved but is never
  scheduled or published automatically.
- `Publisher.publish` accepts only a `PublishableContentItem`, which `toPublishable()` returns solely
  for approved or scheduled items on auto-publish channels.

The rule is enforced twice: by ESLint `no-restricted-imports` per layer, and by
`tests/architecture.test.ts`, which checks package manifests and source imports.

### Adding an adapter

1. Write or extend the contract suite in `packages/testing/contracts/<port>.contract.ts`.
2. Run it from `packages/adapters/test/<adapter>.contract.test.ts` and watch it fail.
3. Implement the adapter in `packages/adapters/src/` until the contract passes.
4. Wire it in the relevant app's `src/container.ts`. That is the only place it is constructed.

### Environment variables

| Variable                | Default | Used by                                                        |
| ----------------------- | ------- | -------------------------------------------------------------- |
| `DATABASE_URL`          | none    | `pnpm db:migrate` (validated with Zod: must be `postgres://…`) |
| `APP_VERSION`           | `0.1.0` | web, worker health reports                                     |
| `HEARTBEAT_INTERVAL_MS` | `60000` | worker                                                         |
