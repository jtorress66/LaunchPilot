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
cp .env.example .env               # local defaults: Postgres in Docker, local test billing
echo "TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env   # encrypts blog passwords
pnpm db:up                         # Postgres 16 via docker compose
set -a && . ./.env && set +a       # load .env into this shell
pnpm db:migrate                    # apply pending migrations (safe to re-run)
pnpm dev                           # web on http://localhost:3000 + worker heartbeat
```

Then open <http://localhost:3000>, click **Start free**, create an account, add a product and try
**Upgrade** (the local billing provider shows a clearly marked test checkout; no payment is taken).
Health check: <http://localhost:3000/api/health>.

### Database

The schema lives in `packages/adapters/src/postgres/migrations/` as ordered, immutable TypeScript
migrations (Kysely). Besides foreign keys and value checks, the database itself refuses rows that
break the product safety rules: approved/scheduled/published content without a founder approval, a
scheduled item without a publish time, and any scheduled or published item on a draft-only channel.

### Accounts

Email + password sign-up. Passwords are hashed with scrypt (salted, constant-time comparison);
sessions are random 256-bit tokens kept in an httpOnly, SameSite=Lax cookie (Secure on https) and
stored in Postgres only as a SHA-256 hash. Sessions last 30 days. Failed logins never reveal whether
an email is registered. One founder owns one workspace.

### Plans and billing

| Plan    | Price  | Products | Content items / month |
| ------- | ------ | -------- | --------------------- |
| Free    | $0     | 1        | 10                    |
| Starter | $29/mo | 1        | 60                    |
| Growth  | $79/mo | 3        | 200                   |

Plans live in one catalog (`packages/domain/src/billing/plans.ts`). Billing providers plug in
through two ports, `CheckoutProvider` and `BillingWebhookVerifier`:

- `BILLING_PROVIDER=local` (development and tests only; refused unless `APP_ENV` is `development`
  or `test`): an in-app test checkout that sends an HMAC-signed webhook through the same endpoint.
- `BILLING_PROVIDER=stripe`: Stripe Checkout (subscription mode) plus signed webhooks at
  `POST /api/billing/webhook`. Prices are found by lookup key, so no price ids are configured.

**Using Stripe**

1. In the Stripe dashboard (test mode) copy your secret key (`sk_test_…`).
2. `STRIPE_SECRET_KEY=sk_test_… pnpm stripe:setup` creates the Starter and Growth prices (idempotent;
   refuses live keys unless you pass `--live`).
3. Locally: `stripe listen --forward-to localhost:3000/api/billing/webhook` prints the
   `whsec_…` webhook secret; set `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY` and
   `STRIPE_WEBHOOK_SECRET`. In production, add a webhook endpoint for
   `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted`.

**CI secret:** the `e2e-stripe` job buys a plan on real Stripe test-mode Checkout. Add your test key
under GitHub → repository **Settings → Secrets and variables → Actions → New repository secret**,
name `STRIPE_SECRET_KEY`. Until then that job fails with a message saying the secret is missing.

### Onboarding and the Product Brief

After adding a product, the founder lands on its **Product Brief** page:

1. **Draft my brief from your site.** `HttpSiteCrawler` reads the home page and up to 7 same-site
   pages (pricing, features, about and FAQ first). It respects `robots.txt` and identifies itself as
   `LaunchPilotBot/1.0`. It allows 10 seconds and 2 MB per page and 60k characters in total.
2. **The brief agent drafts** the audience, problem, solution, differentiators, tone and product
   facts. Every fact must come with a quote copied from the site. Facts whose quote is not on the
   site are dropped (`packages/domain/src/brief/grounding.ts`) and listed for the founder. A draft
   with no grounded facts is refused. This is the code form of "agents may only state product facts
   retrieved from the Product Brief or crawled site".
3. **The founder edits** any field (lists take one item per line) and **approves**. Only a founder can
   approve, approval needs at least one fact, and any later edit returns the brief to draft.

**Drafters** (`BRIEF_DRAFTER`):

- `claude` is the default. It runs `BriefAgent` on `ClaudeLlmClient`, using Claude Opus 5.5
  (`ANTHROPIC_MODEL` to override) with:
  - adaptive thinking at medium effort
  - streaming and structured JSON output
  - a cached system prompt
  - server-side refusal fallback
- `extractive` is offline and deterministic: it quotes sentences from the site. It is for local
  development and E2E tests only, and is refused in production.

**Crawler safety (SSRF):** the crawler checks every address it connects to, after DNS and on every
redirect:

- Private, loopback and CGNAT addresses are refused unless `ALLOW_PRIVATE_NETWORK=true`.
  That setting is allowed only in development and test. The same guard covers the founder's blog.
- Link-local, cloud metadata (169.254.169.254) and multicast addresses are always refused.

### SEO module

Once the brief is approved, the product's **SEO** page runs the loop:

1. **Connect your blog.** WordPress only for now: the founder enters the site address, a username
   and an Application Password (WordPress → Users → Profile → Application Passwords). LaunchPilot
   checks it with the REST API (the user must be able to publish posts) and stores the password
   encrypted with AES-256-GCM (`TOKEN_ENCRYPTION_KEY`). It is never logged or shown again.
2. **Plan articles.** The founder enters up to 5 topics. DataForSEO suggests keyword ideas with
   search volume and difficulty; the domain keeps realistic ones (difficulty ≤ 60, ≥ 10 searches a
   month) and plans one article for each of the best 4, ranked by volume ÷ (difficulty + 10).
3. **Draft.** The SEO writer (Claude, or the offline template writer in dev and test) writes a
   Markdown article for the keyword from the approved brief. It may state only the brief's facts;
   cited facts that are not in the brief are dropped. The article goes to review. Each draft counts
   against the plan's monthly content allowance.
4. **Edit, approve, publish.** The founder edits (which sends it back to review), approves, then
   publishes. Publishing goes through the `PublisherRegistry`, which only accepts approved items on
   auto-publish channels, and posts the article to WordPress as HTML (raw HTML in the Markdown is
   escaped). A failed attempt leaves the article approved, so it can simply be retried.

**DataForSEO account:** sign up at dataforseo.com and copy the API login and password from the
dashboard (API Access). Set `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`. Each plan costs about one
cent. **CI secrets:** the `dataforseo-smoke` job makes one real call; add `DATAFORSEO_LOGIN` and
`DATAFORSEO_PASSWORD` under **Settings → Secrets and variables → Actions**. Until then that job
fails with a message saying the secrets are missing. All other tests use recorded responses.

**E2E:** `pnpm test:e2e` starts a real WordPress (with MariaDB) in Docker, installs it with wp-cli
and creates an Application Password, so the gate test publishes to an actual blog and opens the
live post.

### LLM evals

`pnpm eval` drafts a brief with real Claude for each recorded site in `evals/brief/sites/*.json`.
Each brief is scored on four checks:

- every fact quote appears on the site
- the core fields are filled in
- there are enough facts
- none of the site's "forbidden" claims (things it never says) appear

It then runs the **seo-article** suite: the SEO writer drafts one article per recorded brief in
`evals/seo/cases/*.json`, scored on: cites only brief facts, no "forbidden" claims, the keyword in
the title or first heading, at least 900 words, and at least 3 sections.

The thresholds are 100% for every suite. Below them, the command exits non-zero. It also prints
token usage and an estimated cost: a few cents per run. Run it whenever a prompt in
`packages/agents/src/*/prompt.ts` changes.

**CI secret:** the `eval` job, and the `e2e-stripe` job (whose production configuration drafts with
Claude), need an Anthropic API key. Create one at console.anthropic.com, then add it under GitHub →
repository **Settings → Secrets and variables → Actions → New repository secret**, with the name
`ANTHROPIC_API_KEY`. Until then, both jobs fail with a message saying the secret is missing.

## Commands

| Command               | What it does                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm test`           | Unit + contract tests with coverage thresholds (Vitest)                                        |
| `pnpm test:int`       | Integration tests + repository contracts against real Postgres (Testcontainers), with coverage |
| `pnpm db:up`          | Start the local Postgres container                                                             |
| `pnpm db:migrate`     | Apply pending migrations to `DATABASE_URL`                                                     |
| `pnpm test:e2e`       | Playwright E2E (desktop + mobile); builds and starts the web app                               |
| `pnpm typecheck`      | `tsc --noEmit` in every package                                                                |
| `pnpm lint`           | ESLint, zero warnings allowed                                                                  |
| `pnpm format`         | Prettier write (`pnpm format:check` in CI)                                                     |
| `pnpm eval`           | LLM evals against real Claude (needs `ANTHROPIC_API_KEY`); fails below thresholds              |
| `pnpm smoke:keywords` | One real DataForSEO call (needs `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`)                  |
| `pnpm build`          | Production build of the web app                                                                |

The pre-merge gate is `pnpm test && pnpm typecheck && pnpm lint`. CI
(`.github/workflows/ci.yml`) also runs integration tests, E2E tests and LLM evals. `pnpm test:e2e`
serves a local fixture website (`apps/web/e2e/fixtures/site`) on port 4010 and drafts briefs with
the offline `extractive` drafter.

## Architecture

Ports and adapters. Dependencies point inward only:

```
domain  ←  ports  ←  application  ←  agents / adapters  ←  apps (web, worker)
```

| Path                   | Responsibility                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain`      | Entities (Workspace, Product, Brief, Campaign, Task, ContentItem), value objects, the `ContentItem` state machine, `Result<T, E>`; no I/O, no frameworks                                                                  |
| `packages/ports`       | Interfaces only: `Clock`, `IdGenerator`, `TokenCipher`, `LlmClient`, `BriefDrafter`, `ContentDrafter`, `ContentReviewer`, `CampaignPlanner`, `SiteCrawler`, `KeywordProvider`, `MetricsSource`, `Publisher`, repositories |
| `packages/application` | Use cases that orchestrate domain rules and ports                                                                                                                                                                         |
| `packages/agents`      | AI agents (`BriefAgent`, `ExtractiveBriefDrafter`); implement agent ports, depend on domain and ports only                                                                                                                |
| `packages/adapters`    | Port implementations: Postgres, Stripe, `ClaudeLlmClient`, `HttpSiteCrawler`, WordPress, DataForSEO, crypto, clock                                                                                                        |
| `packages/testing`     | A fake for every port, entity fixtures (`aContentItem({ status })`…), shared contract suites                                                                                                                              |
| `apps/web`             | Next.js UI + thin API routes; wiring in `src/container.ts`                                                                                                                                                                |
| `apps/worker`          | Background jobs; wiring in `src/container.ts`                                                                                                                                                                             |

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

| Variable                | Default           | Used by                                                                             |
| ----------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`          | none              | web, `pnpm db:migrate` (must be `postgres://…`)                                     |
| `APP_URL`               | none              | web: absolute base URL for redirects and cookies (Secure when https)                |
| `APP_ENV`               | `production`      | web: `development`, `test` or `production`                                          |
| `BILLING_PROVIDER`      | none              | web: `local` or `stripe`                                                            |
| `LOCAL_BILLING_SECRET`  | none              | web with local billing: at least 16 characters                                      |
| `STRIPE_SECRET_KEY`     | none              | web with Stripe billing, `pnpm stripe:setup`                                        |
| `STRIPE_WEBHOOK_SECRET` | none              | web with Stripe billing (`whsec_…`)                                                 |
| `BRIEF_DRAFTER`         | `claude`          | web: `claude` or `extractive` (development and test only)                           |
| `ARTICLE_WRITER`        | `claude`          | web: `claude` or `template` (development and test only)                             |
| `ANTHROPIC_API_KEY`     | none              | web when Claude drafts, `pnpm eval`. Never logged                                   |
| `ANTHROPIC_MODEL`       | `claude-opus-5-5` | web, `pnpm eval`: the Claude model for briefs and articles                          |
| `TOKEN_ENCRYPTION_KEY`  | none              | web: 32 random bytes, base64 (`openssl rand -base64 32`)                            |
| `KEYWORD_PROVIDER`      | `dataforseo`      | web: `dataforseo` or `offline` (development and test only)                          |
| `DATAFORSEO_LOGIN`      | none              | web with DataForSEO, `pnpm smoke:keywords`                                          |
| `DATAFORSEO_PASSWORD`   | none              | web with DataForSEO, `pnpm smoke:keywords`. Never logged                            |
| `DATAFORSEO_BASE_URL`   | DataForSEO API    | web: another base URL, for tests                                                    |
| `ALLOW_PRIVATE_NETWORK` | `false`           | web: `true` lets the crawler and publishers reach localhost/LAN (dev and test only) |
| `APP_VERSION`           | `0.1.0`           | web, worker health reports                                                          |
| `HEARTBEAT_INTERVAL_MS` | `60000`           | worker                                                                              |

All configuration is validated with Zod when the app first handles a request; an invalid value
fails fast with a message naming the variable.
