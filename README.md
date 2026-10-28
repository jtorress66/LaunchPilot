# Nuvantre

Nuvantre is an AI marketing app for SaaS founders. It reads a founder's SaaS, writes a Product
Brief, and runs SEO content, launches/directories, social posting and analytics on a weekly loop.
The founder approves everything before it is published.

> **Status:** build step 7 (Social module) of 11. See [`docs/BUILD_STEPS.md`](docs/BUILD_STEPS.md).
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
pnpm db:migrate                    # apply pending migrations and sync the directory catalogue (safe to re-run)
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

**Renamed from LaunchPilot:** the local Postgres user and database are now `nuvantre`. A volume
created before the rename still holds the old `launchpilot` role, so reset it once with
`docker compose down -v && docker compose up -d`, then `pnpm db:migrate`. Stripe subscriptions on
the old `launchpilot_*_monthly` prices keep mapping to their plans; `pnpm stripe:setup` creates the
`nuvantre_*_monthly` prices that new checkouts use.

### Accounts

Email + password sign-up. Passwords are hashed with scrypt (salted, constant-time comparison);
sessions are random 256-bit tokens kept in an httpOnly, SameSite=Lax cookie (Secure on https) and
stored in Postgres only as a SHA-256 hash. Sessions last 30 days. Failed logins never reveal whether
an email is registered. One founder owns one workspace.

### Plans and billing

| Plan    | Price   | Products                       | Content items / month   |
| ------- | ------- | ------------------------------ | ----------------------- |
| Free    | $0      | 1                              | 10                      |
| Starter | $29/mo  | 1                              | 60                      |
| Growth  | $79/mo  | 3                              | 200                     |
| Agency  | $199/mo | 3, plus 10 clients with 3 each | 200, and 200 per client |

Plans live in one catalog (`packages/domain/src/billing/plans.ts`). Billing providers plug in
through two ports, `CheckoutProvider` and `BillingWebhookVerifier`:

- `BILLING_PROVIDER=local` (development and tests only; refused unless `APP_ENV` is `development`
  or `test`): an in-app test checkout that sends an HMAC-signed webhook through the same endpoint.
  Its billing page also offers **Cancel plan (test)**, which sends a cancellation webhook, to try a
  downgrade.
- `BILLING_PROVIDER=stripe`: Stripe Checkout (subscription mode) plus signed webhooks at
  `POST /api/billing/webhook`. Prices are found by lookup key, so no price ids are configured.

**Using Stripe**

1. In the Stripe dashboard (test mode) copy your secret key (`sk_test_…`).
2. `STRIPE_SECRET_KEY=sk_test_… pnpm stripe:setup` creates the Starter, Growth and Agency prices (idempotent;
   refuses live keys unless you pass `--live`).
3. Locally: `stripe listen --forward-to localhost:3000/api/billing/webhook` prints the
   `whsec_…` webhook secret; set `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY` and
   `STRIPE_WEBHOOK_SECRET`. In production, add a webhook endpoint for
   `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted`.

**CI secret:** the `e2e-stripe` job buys a plan on real Stripe test-mode Checkout. Add your test key
under GitHub → repository **Settings → Secrets and variables → Actions → New repository secret**,
name `STRIPE_SECRET_KEY`. Until then that job fails with a message saying the secret is missing.

### Several products

A workspace holds as many products as its plan allows. Archived products don't count.

- **Switching:** every product page has a **Product** switcher. It keeps the section, so a
  product's SEO page leads to the next product's SEO page. Tabs move between Brief, SEO, Social,
  Launch and Analytics.
- **Dashboard:** one card per product, showing:
  - whether the product is active or paused, and its brief status
  - items waiting for approval, scheduled, and published this month
  - whether a blog is connected, and whether autopilot is on
  - visitors in the latest weekly report
- **Paused:** when a workspace has more products than its plan allows (after a downgrade, for
  example), the products after the plan's limit are paused. By default the oldest stay active.
  - A paused product can be read, edited and approved.
  - Nothing is drafted, published or scheduled for it, and its autopilot and weekly reports don't
    run. Every refusal says why and how to free a slot.
  - Its due posts stay scheduled (the publish job counts them as `held`) and go out once it is
    active again.
  - **Make active** swaps a paused product with the active product the founder picks.
- **Archived:** archiving puts a product aside. Its work is kept, it frees a slot and it leaves the
  switcher. **Restore** brings it back, if the plan has a free slot.

Which products are active is worked out from the plan each time, not stored: `allocateSlots` in
`packages/domain/src/product/product-slots.ts`, enforced by `loadActiveProduct` and `ensureActive`
in `packages/application/src/active-product.ts`.

### Agencies, roles and branded reports

An agency on the **Agency** plan adds up to 10 **client workspaces** (**Clients** page). Each
client has its own products, brief, content, Activity and reports, and runs on the client plan
(3 products, 200 items a month) while the agency pays for Agency. If the agency leaves the plan,
its clients drop to Free and their extra products pause.

- **Switching:** the header's **Workspace** switcher lists the person's own workspace, each
  workspace they were invited to, and (for agency staff) every client. The session remembers the
  choice; access is checked again on every request.
- **Roles** (one permission table, `packages/domain/src/agency/roles.ts`):

  | Role          | Can                                                        |
  | ------------- | ---------------------------------------------------------- |
  | Owner         | everything, including billing, team, clients and branding  |
  | Team member   | draft, approve, publish, connect accounts and send reports |
  | Client viewer | read reports and Activity; nothing else                    |

  An agency's owners and members keep their role in every client. Approving, scheduling and
  publishing check the role in the use cases themselves, so a client viewer can never reach a
  public channel. Every server action also checks it (`requireAccess`).

- **Team:** owners invite people by email as a team member or client viewer. The link lasts 7
  days; only a hash of its token is stored. A new person signs up from the link, then accepts.
  The last owner cannot be removed.
- **Branding** (**Branding** page, on the agency): sender name, accent colour, optional logo and
  footer, and the reply-to address. Every client's reports use it.
- **Report email:** a report page's **Email this report** sends it to up to 10 addresses from the
  agency's name, in its colours, with no mention of Nuvantre. **Email every new weekly report**
  makes the worker send each new weekly report to that list. Emails go through Resend
  (`MAILER=resend`, `RESEND_API_KEY`, `MAIL_FROM` on a domain verified in Resend); a retry never
  sends twice (idempotency key per report, recipients and day). Sending is rate limited to 50 an
  hour per workspace.

### Onboarding and the Product Brief

After adding a product, the founder lands on its **Product Brief** page:

1. **Draft my brief from your site.** `HttpSiteCrawler` reads the home page and up to 7 same-site
   pages (pricing, features, about and FAQ first). It respects `robots.txt` and identifies itself as
   `NuvantreBot/1.0`. It allows 10 seconds and 2 MB per page and 60k characters in total.
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

1. **Connect your blog.** The founder picks the platform (WordPress, Ghost, Shopify, Webflow or
   Wix) and pastes a key; see **Blog platforms** below for where each key lives. Nuvantre checks it
   with that platform's official API before saving, and stores the key encrypted with AES-256-GCM
   (`TOKEN_ENCRYPTION_KEY`). It is never logged or shown again. Reconnecting, on the same or another
   platform, replaces the old connection.
2. **Choose the language and market.** Each product has one (US English by default), set under
   **Language and market**: any language and country the runtime's Unicode data names. Articles,
   social posts and reviews are written in it, and keyword research targets that market.
3. **Plan articles.** The founder enters up to 5 topics. DataForSEO suggests keyword ideas with
   search volume and difficulty for the product's market; the domain keeps realistic ones
   (difficulty ≤ 60, ≥ 10 searches a month) and plans one article for each of the best 4, ranked by
   volume ÷ (difficulty + 10). Which markets have keyword data comes from DataForSEO's own
   `locations_and_languages` list, read once per process. In a market it does not cover, each topic
   becomes an article without search figures, labelled "No search data for this market yet".
4. **Draft.** The SEO writer (Claude, or the offline template writer in dev and test) writes a
   Markdown article for the keyword from the approved brief, in the product's language. It may
   state only the brief's facts; cited facts that are not in the brief are dropped. It also gives a
   URL slug and an excerpt for search results, and may link only to the product's own published
   articles (up to 10, newest first): any other link is turned into plain text in code. The article
   goes to review. Each draft counts against the plan's monthly content allowance.
5. **Edit, approve, publish.** The founder edits the title, article, URL slug or excerpt (which
   sends it back to review), approves, then publishes. Publishing goes through the
   `PublisherRegistry`, which only accepts approved items on auto-publish channels, and makes the
   article live on the connected blog with its slug and excerpt (raw HTML in the Markdown is
   escaped). On WordPress, which adds `-2` to a slug that is taken, many themes and SEO plugins use
   the excerpt as the meta description; Yoast and Rank Math's own meta fields need their REST
   extensions, so they are not set. A failed attempt leaves the article approved, so it can simply
   be retried.

**DataForSEO account:** sign up at dataforseo.com and copy the API login and password from the
dashboard (API Access). Set `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`. Each plan costs about one
cent. **CI secrets:** the `dataforseo-smoke` job researches one US English and one Brazilian
Portuguese topic for real; add `DATAFORSEO_LOGIN` and
`DATAFORSEO_PASSWORD` under **Settings → Secrets and variables → Actions**. Until then that job
fails with a message saying the secrets are missing. To use DataForSEO's free Sandbox (made-up
data, no charge), also add the repository **variable** `DATAFORSEO_BASE_URL` =
`https://sandbox.dataforseo.com`. All other tests use recorded responses.

**E2E:** `pnpm test:e2e` starts a real WordPress (with MariaDB) in Docker, installs it with wp-cli
and creates an Application Password, so the gate test publishes to an actual blog and opens the
live post. It also starts a real Ghost 5 and stand-ins for the Shopify, Webflow and Wix APIs (see
below).

#### Blog platforms

| Platform  | The founder enters                                        | Where to find it                                                                                                    | Published as                                                                     |
| --------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| WordPress | Blog address, username, Application Password              | Users → Profile → Application Passwords (an Editor or Administrator)                                                | REST API post, `status: publish`                                                 |
| Ghost     | Blog address, Admin API key (`id:secret`)                 | Settings → Integrations → Add custom integration                                                                    | Admin API post, `status: published`, signed with a 5-minute HS256 token          |
| Shopify   | Store address (`*.myshopify.com`), Admin API access token | Settings → Apps → Develop apps: a custom app with `write_content`, installed                                        | GraphQL Admin `articleCreate` on the store's first blog, `isPublished: true`     |
| Webflow   | Site address, Webflow collection ID, site API token       | Site settings → Apps & integrations → API access (CMS read and write); the collection ID is in CMS → the collection | Data API v2 live item; body in the collection's Rich Text field                  |
| Wix       | Site address, Wix site ID, API key                        | Account settings → API Keys (Wix Blog permissions); the site ID is in the dashboard's address                       | Blog API draft post created with `publish: true`; the body is Ricos rich content |

Each platform is one row in the domain's platform table (`packages/domain/src/connections/blog-platform.ts`),
one verifier and one publisher in `packages/adapters`, and one entry in each composition root. Every
platform passes the same shared verifier, publisher and provider contracts.

**What is checked against what.** The build environment cannot reach any platform's API, so:

- **WordPress and Ghost** are checked against the real software in E2E (Docker).
- **Shopify, Webflow and Wix** request and response formats follow their documented APIs and are
  checked against recorded responses (`packages/adapters/test/*/recorded`) and local stand-ins in
  E2E (`scripts/e2e-blogs.mjs`). Shopify uses the pinned GraphQL Admin API version in
  `SHOPIFY_API_VERSION`. Wix is the least certain: if its API wants a member as the post's owner, set
  a `memberId` setting on the connection.
- **`pnpm smoke:blogs`** confirms them against real test accounts, read-only (it connects; it never
  publishes). It checks each platform whose variables are set and skips the rest: `SHOPIFY_STORE_URL`
  and `SHOPIFY_ACCESS_TOKEN`; `WEBFLOW_SITE_URL`, `WEBFLOW_COLLECTION_ID` and `WEBFLOW_API_TOKEN`;
  `WIX_SITE_URL`, `WIX_SITE_ID` and `WIX_API_KEY`. In CI, add the tokens as repository secrets and
  the rest as repository variables; until then the `blogs-smoke` job passes with a "skipped" note.

### Social module

The product's **Social** page (it needs an approved brief) and the **Inbox** run the loop:

1. **Connect X and LinkedIn.** One button per channel. Nuvantre creates a
   [Zernio](https://zernio.com) profile for the product, the first time only, then sends the
   founder to the platform's own sign-in page through Zernio. Nuvantre never sees their
   passwords. When the founder comes back, Nuvantre stores which accounts they linked.
2. **Draft the week.** The social writer (Claude, or the offline template writer in dev and test)
   drafts 3 X posts and 2 LinkedIn posts. Angles come from the brief's differentiators and facts;
   when a blog article was published, the first post on each channel promotes it, with its link.
   Posts may state only the brief's facts. X posts are at most 280 characters and LinkedIn posts at
   most 3,000; the writer asks Claude for one shorter rewrite before giving up. Each post counts
   against the plan's monthly allowance, and drafting stops cleanly when it runs out.
3. **Approve.** The **Inbox** (header link, with a count) lists everything waiting for review,
   across products and channels, with a full preview and a character count.
4. **Publish now or schedule.** On the post page the founder edits (with a live character
   counter), approves, then publishes now or schedules a date and time (entered in their own
   timezone, stored in UTC). The calendar shows the next 14 days (UTC) and the approved posts that
   are not scheduled yet.
5. **Worker.** Every minute (`PUBLISH_INTERVAL_MS`), the worker publishes scheduled posts whose
   time has come, up to 20 per run, earliest first. A temporary failure keeps the post scheduled
   and it is retried on the next run, up to 3 attempts. Each publish carries an idempotency key, so
   a retry after a timeout can never post twice. A permanent failure (rejected by the platform,
   account not linked, payment needed) marks it **Failed** with the reason, and the founder can
   edit or retry. Run one worker instance for now; concurrent workers need a lock (step 11).

Only founder-approved posts reach X or LinkedIn: publishing goes through `toPublishable` and the
`PublisherRegistry`, where X and LinkedIn are two registered `ZernioPublisherProvider`s behind the
`Publisher` port. Posting uses Zernio's official API only: no likes, follows or DMs.

**Zernio setup:**

1. Create an account at zernio.com, then **Settings → API Keys → Create**. Copy the key (it starts
   with `sk_` and is shown once) into `.env` as `ZERNIO_API_KEY`. `set -a && . ./.env` loads it
   for `pnpm dev`. The key is never stored in the database or logged.
2. Profiles are created automatically, one per product. Nothing else to configure.
3. **X needs a payment method:** Zernio passes X's API costs through, so add a card under Billing
   before connecting an X account. Otherwise publishing to X fails with a "payment method" message.

**CI secret:** the `zernio-smoke` job makes read-only calls to the real API (it lists profiles and
accounts and never posts), proving that the key works and that Zernio's responses still match the
adapter. Add `ZERNIO_API_KEY` under GitHub → repository **Settings → Secrets and variables →
Actions → New repository secret**. Until then that job fails with a message saying the secret is
missing. All other tests use recorded responses, or, in E2E, a local Zernio-compatible stub
(`scripts/e2e-zernio.mjs`).

**Zernio API changes:** the daily `Zernio changelog` workflow (`.github/workflows/zernio-changelog.yml`)
reads Zernio's public API changelog. It is the same feed as Zernio's `api.changelog.published`
webhook, but it needs no key and no deployed endpoint. The workflow opens one GitHub issue, labelled
`zernio-changelog`, for each entry that does any of these:

- changes or removes an endpoint Nuvantre calls
- removes a response schema the adapter reads
- needs action on X or LinkedIn
- deprecates something on X or LinkedIn
- is a breaking change for every integration

It never opens the same issue twice. Run it by hand with `pnpm watch:zernio --days 30`, or from the
Actions tab. Once the app is deployed (step 11), the webhook can replace it.

### Launch module

The product's **Launch** page (it needs an approved brief) has three parts. Nuvantre never
submits or posts anything here: the founder submits each listing and community post by hand.

1. **Launch kit.** The launch writer (Claude, or the offline template writer in dev and test)
   drafts the listing copy:
   - name and tagline (at most 60 characters each)
   - short description (160) and long description (1,000)
   - 3 to 6 key features and 1 to 3 categories
   - the maker's first comment

   It also drafts three community posts: Show HN (title starts "Show HN:", at most 80
   characters), Reddit and Indie Hackers. The kit may state only the brief's facts. If a field is
   too long, the writer asks Claude for one rewrite before giving up. The founder edits each field
   (with a character counter) and approves the kit. Any later edit sends it back for approval.
   The community posts are ordinary content items on draft-only channels: they appear in the
   **Inbox**, are approved there, and their page offers **Copy** and **Open Show HN** (or Reddit /
   Indie Hackers) instead of Publish. Only the three community posts count against the plan's
   monthly allowance; the kit itself is not a content item.

2. **Where to launch.** A curated catalogue of 29 launch platforms, directories and communities,
   filtered by kind and price. Free ones show by default; paid ones are clearly marked with a price
   note. Each entry shows its topics and the date its details were last checked. **Add to my
   launch** creates a tracker row.
3. **Tracker.** One row per directory, with the listing fitted to that directory's limits (a field
   over the limit gets a warning; text is never cut), a copy button per field and a link to the
   submit page. Statuses: Planned → Submitted → Live (with the listing URL) or Rejected (with a
   reason). A row can also be Skipped, and a Rejected or Skipped row can be reopened. **Submitted
   needs an approved kit**; for a community, it also needs that community's post to be approved. A
   row still waiting 14 days after submission shows **Follow up**.

**The catalogue** lives in `packages/adapters/src/postgres/seeds/directories.json`. Each entry is
validated by the domain's `parseDirectory`. `pnpm db:migrate` syncs it into the `directories` table
after migrating: new and changed entries are upserted, and entries removed from the file are
deleted unless a submission still tracks them. To add a directory, add a JSON entry; no code
changes. The details (submit URL, pricing, limits) were gathered from public search results and
may drift: re-check an entry and update its `checkedAt` when you edit it. Product Hunt's 60-character
tagline limit comes from third-party guides, not from Product Hunt's own documentation.

### Analytics module

The product's **Analytics** page connects read-only sources and shows the weekly report.

1. **Connect Google.** One sign-in covers Search Console and Google Analytics 4. Nuvantre asks
   Google for read-only access (`webmasters.readonly`, `analytics.readonly`, plus `openid email`
   to name the account). The refresh token is encrypted at rest and never logged. The OAuth
   `state` is kept in a short-lived httpOnly cookie and checked on the way back. The founder then
   picks a Search Console property and a GA4 property from the lists Google returns. Either can be
   left empty.
2. **Connect Plausible.** Site domain plus a Stats API key (Plausible → Settings → API keys).
   Nuvantre checks both with one small query before storing the key, encrypted. A self-hosted
   Plausible address is accepted; it goes through the same SSRF guard as founder blog URLs.
3. **Weekly report.** Weeks run Monday 00:00 to Monday 00:00 UTC. The worker builds last week's
   report for every connected product from Monday 06:00 UTC (and catches up on later runs), at
   most 20 per run. **Build report now** rebuilds the latest complete week in place. Each report
   shows:
   - visitors and pageviews (GA4 is preferred when both GA4 and Plausible answer)
   - search clicks, impressions, CTR and average position (from Search Console)
   - each figure's change against the week before, as an arrow, a signed percentage and a
     better/worse label (a lower position is better)
   - the top 10 pages and the top 10 search queries
   - a status line per source: ok, not connected, or failed with the reason
   - the analyst's notes: a short summary, highlights and 1 to 3 suggestions for next week

   A source that fails does not block the report; it is built from the sources that answered.
   The analyst (Claude, or the offline template analyst in dev and test) may state only numbers
   that are in the report and facts from the approved brief; a note with any other number gets
   one rewrite and is otherwise dropped, and the report is saved without notes.

Sources report in their own time zones (Search Console uses Pacific time, GA4 and Plausible the
property's or site's time zone), so a "week" is the same seven calendar dates in each source.

**Google Cloud setup** (once per deployment):

1. In [Google Cloud console](https://console.cloud.google.com/) create a project, then enable the
   **Google Search Console API**, **Google Analytics Data API** and **Google Analytics Admin API**.
2. **APIs & Services → OAuth consent screen:** user type External, add the scopes
   `.../auth/webmasters.readonly` and `.../auth/analytics.readonly`. While the app is in
   **Testing**, only the test users you list can connect, and Google expires their refresh tokens
   after 7 days; publish the app (Google reviews these scopes) before real founders use it.
3. **Credentials → Create credentials → OAuth client ID → Web application.** Authorised redirect
   URI: `${APP_URL}/api/google/callback` (e.g. `http://localhost:3000/api/google/callback`).
4. Put the client ID and secret in `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, for
   both the web app and the worker. Without them, the Analytics page offers Plausible only.

**Recorded data:** the adapters' tests, the step 9 gate test
(`apps/worker/test/weekly-report.int.test.ts`) and the E2E stand-in (`scripts/e2e-analytics.mjs`)
replay the same responses in `packages/adapters/test/google/recorded` and `.../plausible/recorded`.
They were written from Google's and Plausible's documented response shapes, because those APIs are
not reachable from the build sandbox; re-record them from a real account when one is available.

### Orchestration (weekly autopilot)

The **Weekly autopilot** card on the product's Analytics page (linked from the dashboard) runs the
whole loop: **report → plan → draft → review → Inbox**. It is off until the founder turns it on.

1. **When it runs.** Every Monday from 07:00 UTC (after the 06:00 weekly reports) the worker runs
   this week's loop for every product with the autopilot on, at most 10 per check. **Run this week
   now** runs it on demand. A week runs once per product: a completed week is never re-run, while a
   skipped week (for example, no approved brief yet) can be retried with **Run this week now**.
2. **Plan.** The strategist reads the approved brief, last week's report (if there is one), the
   remaining monthly content allowance and the candidates Nuvantre offers: up to 6 ranked
   keyword opportunities researched from last week's top searches and the brief, and brief-derived
   angles for X and LinkedIn. Nuvantre then checks the plan: SEO articles go only to the blog
   and posts only to X or LinkedIn (launch and community work stays with the founder), every task
   must use an offered keyword or angle, no repeats, at most 2 articles, 3 X posts and 2 LinkedIn
   posts a week, and articles first within the allowance. Any other task is dropped with a reason.
   A rationale may cite only figures from the report or the keyword research.
3. **Draft and review.** The article writer drafts each article and the social writer each post.
   The reviewer then checks each draft. It blocks, without asking the model:
   - over-length text
   - a missing required link
   - hype words
   - figures the brief does not state

   With Claude it also flags claims the brief does not support, tone and clarity. A draft with a
   blocker gets one rewrite with the reviewer's notes, then a second review.

4. **Inbox.** Every draft lands **in review** with the reviewer's verdict ("Reviewer: passes", or
   the issues it found). The reviewer only recommends: the founder approves and publishes exactly
   as before, and nothing is published without that approval. One failed draft does not stop the
   rest of the week; the card shows the run's summary (drafts waiting, rewritten after review,
   failed, stopped at the plan's monthly limit).

### Hardening for beta

- **Rate limits** (Postgres counters, fixed windows; `packages/application/src/rate-limits.ts`):
  login 10 per 15 minutes per address and email, sign-up 5 per hour per address, AI drafting 30
  and connecting accounts 20 per hour per workspace, webhooks 120 per minute per address. A
  refusal reads "Too many attempts. Try again in N minutes." (HTTP 429 with `Retry-After` on the
  webhook). The worker purges old counters hourly.
- **Monitoring:** every response carries an `x-request-id`. Errors in pages, actions, route
  handlers and worker jobs go to the `ErrorReporter`: one JSON line on stderr, plus Sentry when
  `SENTRY_DSN` is set (no PII, secrets scrubbed). `GET /api/health` is liveness;
  `GET /api/health/ready` returns 503 when Postgres does not answer. The worker heartbeat lists
  each job's last success.
- **Worker lock:** each job runs under a Postgres advisory lock, so a second worker skips a job the
  first is running and nothing publishes twice.
- **Activity** (`/app/activity`): who signed in, added, archived or activated a product,
  approved a brief or content, published, scheduled, connected an account, changed plan or
  autopilot, newest first. Entries hold only a short label, never post text or secrets.
- **Security:** a nonce-based Content-Security-Policy and HSTS (over https) on every page, a
  `__Host-` session cookie over https, and a CI `security` job: `pnpm audit --audit-level high
--prod` and a gitleaks secret scan of the whole history (`.gitleaks.toml` allows test fixtures).

The beta checklist, with the proof for each item, is in `docs/BETA_CHECKLIST.md`.

### LLM evals

`pnpm eval` drafts a brief with real Claude for each recorded site in `evals/brief/sites/*.json`.
Each brief is scored on four checks:

- every fact quote appears on the site
- the core fields are filled in
- there are enough facts
- none of the site's "forbidden" claims (things it never says) appear

It then runs the **seo-article** suite: the SEO writer drafts one article per recorded brief in
`evals/seo/cases/*.json`, scored on: cites only brief facts, no "forbidden" claims, the keyword in
the title or first heading, at least 900 words, at least 3 sections, a valid slug with a keyword word
and an excerpt of at most 160 characters, links only to the case's published articles (judged on the
model's own answer, before the writer unlinks anything), at least one such link when the case offers
some, and the case's language. Cases cover English, German (`de-DE`) and Brazilian Portuguese
(`pt-BR`). The language check counts common words for English, German, Portuguese and Spanish, and
the length check counts words, so languages written without spaces (Chinese, Japanese) are not
evaluated yet.

Then comes the **social-post** suite: the social writer drafts the X and LinkedIn angles in
`evals/social/cases/*.json`. Each post must stay within its channel's limit, cite only brief facts,
avoid the "forbidden" claims, use at most 2 hashtags on X (3 on LinkedIn), include the link when
the angle has one, and be in the case's language (one case is German).

Then comes the **launch-kit** suite: the launch writer drafts one kit per recorded brief in
`evals/launch/cases/*.json`. Each kit must keep every listing field within its limit, cite only
brief facts, avoid the "forbidden" claims and hype words ("revolutionary", "#1", …), give the
Show HN post a title that starts "Show HN:" within 80 characters, and include all three community
posts.

Then comes the **analyst** suite: the analyst writes notes on each recorded week in
`evals/analytics/cases/*.json` (one full week from all three sources, one with a failed source and
falling visitors). The notes must state only numbers that are in the report, cite only brief facts,
avoid the "forbidden" claims (invented causes such as "thanks to", signups, revenue) and hype, give
1 to 3 suggestions, and name the week's biggest change in the summary.

Then comes the **strategist** suite: the strategist plans each recorded week in
`evals/strategy/cases/*.json` (one with last week's report, one first week with no report). Each
plan must use only offered keywords and angles on plannable channels, stay within the allowance
and the weekly channel caps, state only figures from the report, the keyword research or the brief,
have a goal, avoid hype, and mix articles and posts.

Last comes the **reviewer** suite: the reviewer checks hand-labelled drafts in
`evals/review/cases/*.json` (3 good; 5 bad: an invented fact, over length, hype, a missing link,
and a draft in the wrong language, which only the model can catch).
Its verdict must match every label, and a held-back draft must name at least one blocker.

The thresholds live in `evals/thresholds.json` (100% for every suite today); a unit test fails if a
suite has no entry or one drops below the last agreed value. Below them, the command exits
non-zero. Each suite's scores are written to `evals/results.json`, which CI keeps as the
`eval-results` artifact. It also prints
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
| `pnpm db:migrate`     | Apply pending migrations to `DATABASE_URL`, then sync the directory catalogue                  |
| `pnpm test:e2e`       | Playwright E2E (desktop + mobile); builds and starts the web app                               |
| `pnpm typecheck`      | `tsc --noEmit` in every package                                                                |
| `pnpm lint`           | ESLint, zero warnings allowed                                                                  |
| `pnpm format`         | Prettier write (`pnpm format:check` in CI)                                                     |
| `pnpm eval`           | LLM evals against real Claude (needs `ANTHROPIC_API_KEY`); fails below thresholds              |
| `pnpm smoke:keywords` | One real DataForSEO call (needs `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`)                  |
| `pnpm smoke:social`   | Read-only calls to the real Zernio API (needs `ZERNIO_API_KEY`); never posts                   |
| `pnpm smoke:blogs`    | Connect check against Shopify, Webflow and Wix test accounts that are configured; never posts  |
| `pnpm watch:zernio`   | Lists Zernio API changelog entries that affect the integration (no key needed)                 |
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
| `packages/agents`      | AI agents (`BriefAgent`, `SeoArticleWriter`, `SocialPostWriter` and offline stand-ins); implement agent ports, depend on domain and ports only                                                                            |
| `packages/adapters`    | Port implementations: Postgres, Stripe, `ClaudeLlmClient`, `HttpSiteCrawler`, WordPress, Ghost, Shopify, Webflow, Wix, DataForSEO, Zernio, crypto, clock                                                                  |
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

| Variable                | Default           | Used by                                                                               |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | none              | web, worker, `pnpm db:migrate` (must be `postgres://…`)                               |
| `APP_URL`               | none              | web: absolute base URL for redirects and cookies (Secure when https)                  |
| `APP_ENV`               | `production`      | web: `development`, `test` or `production`                                            |
| `BILLING_PROVIDER`      | none              | web: `local` or `stripe`                                                              |
| `LOCAL_BILLING_SECRET`  | none              | web with local billing: at least 16 characters                                        |
| `STRIPE_SECRET_KEY`     | none              | web with Stripe billing, `pnpm stripe:setup`                                          |
| `STRIPE_WEBHOOK_SECRET` | none              | web with Stripe billing (`whsec_…`)                                                   |
| `BRIEF_DRAFTER`         | `claude`          | web: `claude` or `extractive` (development and test only)                             |
| `ARTICLE_WRITER`        | `claude`          | web, worker (autopilot): `claude` or `template` (development and test only)           |
| `ANTHROPIC_API_KEY`     | none              | web when Claude drafts, worker when an agent uses Claude, `pnpm eval`. Never logged   |
| `ANTHROPIC_MODEL`       | `claude-opus-5-5` | web, `pnpm eval`: the Claude model for briefs and articles                            |
| `TOKEN_ENCRYPTION_KEY`  | none              | web, worker: 32 random bytes, base64 (`openssl rand -base64 32`)                      |
| `KEYWORD_PROVIDER`      | `dataforseo`      | web, worker (autopilot): `dataforseo` or `offline` (development and test only)        |
| `DATAFORSEO_LOGIN`      | none              | web with DataForSEO, `pnpm smoke:keywords`                                            |
| `DATAFORSEO_PASSWORD`   | none              | web with DataForSEO, `pnpm smoke:keywords`. Never logged                              |
| `DATAFORSEO_BASE_URL`   | DataForSEO API    | web: another base URL, for tests                                                      |
| `ALLOW_PRIVATE_NETWORK` | `false`           | web: `true` lets the crawler and publishers reach localhost/LAN (dev and test only)   |
| `APP_VERSION`           | `0.1.0`           | web, worker health reports                                                            |
| `HEARTBEAT_INTERVAL_MS` | `60000`           | worker                                                                                |
| `SOCIAL_WRITER`         | `claude`          | web, worker (autopilot): `claude` or `template` (development and test only)           |
| `LAUNCH_WRITER`         | `claude`          | web: `claude` or `template` (development and test only)                               |
| `ZERNIO_API_KEY`        | none              | web, worker, `pnpm smoke:social`. Never logged                                        |
| `ZERNIO_BASE_URL`       | Zernio API        | web, worker: another base URL, for tests                                              |
| `WEBFLOW_API_BASE_URL`  | Webflow Data API  | web, worker: a local stand-in for the Webflow API (development and test only)         |
| `WIX_API_BASE_URL`      | Wix REST API      | web, worker: a local stand-in for the Wix API (development and test only)             |
| `PUBLISH_INTERVAL_MS`   | `60000`           | worker: how often scheduled posts are published (at least 5000)                       |
| `GOOGLE_CLIENT_ID`      | none              | web, worker: Google OAuth client (with the secret, or neither: then no Google)        |
| `GOOGLE_CLIENT_SECRET`  | none              | web, worker. Never logged                                                             |
| `GOOGLE_API_BASE_URL`   | Google APIs       | web, worker: one local stand-in for every Google endpoint (development and test only) |
| `ANALYST`               | `claude`          | web, worker: `claude` or `template` (development and test only)                       |
| `REPORT_INTERVAL_MS`    | `3600000`         | worker: how often it checks for due weekly reports (at least 60000)                   |
| `STRATEGIST`            | `claude`          | web, worker: `claude` or `template` (development and test only)                       |
| `REVIEWER`              | `claude`          | web, worker: `claude` or `template` (development and test only)                       |
| `LOOP_INTERVAL_MS`      | `3600000`         | worker: how often it checks for due autopilot weeks (at least 60000)                  |
| `SENTRY_DSN`            | none              | web, worker: report errors to Sentry too (secrets scrubbed); without it, JSON logs    |
| `TRUST_PROXY`           | `false`           | web: `true` takes the client address from `X-Forwarded-For` (only behind a proxy)     |
| `MAILER`                | `resend`          | web, worker: `resend`, or `log` to only log (development and test only)               |
| `RESEND_API_KEY`        | none              | web, worker: sends invitations and reports through Resend. Never logged               |
| `MAIL_FROM`             | none              | web, worker: the sending address, on a domain verified in Resend                      |
| `RESEND_BASE_URL`       | Resend API        | web, worker: a local stand-in for Resend (development and test only)                  |
| `RATE_LIMIT_OVERRIDES`  | none              | web: raise limits, e.g. `signup=1000,draft=500` (development and test only)           |

All configuration is validated with Zod when the app first handles a request; an invalid value
fails fast with a message naming the variable.
