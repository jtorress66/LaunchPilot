# LaunchPilot — Build Steps

Place this file at `docs/BUILD_STEPS.md`. Work on one step at a time. Tick a step only when its gate passes and the Definition of Done in `CLAUDE.md` is met.

**Current step:** 4

| # | Step | Scope | Gate (must pass before next step) | Done |
| --- | --- | --- | --- | --- |
| 1 | Foundation | pnpm monorepo, TypeScript strict, Vitest, Playwright, ESLint, GitHub Actions CI, package skeletons | CI green on a sample unit test and a sample E2E test | [x] |
| 2 | Domain and ports | Entities (Workspace, Product, Brief, Campaign, Task, ContentItem), `ContentItem` state machine, all port interfaces, fakes | 100% unit coverage on the state machine; ports have fakes in `packages/testing` | [x] |
| 3 | Persistence | Postgres schema + migrations, repository adapters | Repository contract suites pass against a real test DB (Testcontainers) | [x] |
| 4 | Auth, workspaces, billing | Sign-up/login, workspaces, products, Stripe subscriptions and plan limits | E2E: sign up → create product → buy plan (Stripe test mode) | [x] |
| 5 | Onboarding and Product Brief | Crawler adapter, brief agent, brief editor UI | E2E: paste URL → brief drafted → edited → approved | [ ] |
| 6 | SEO module | Keyword provider, content plan, article writer, CMS publisher | E2E: article drafted → approved → published to a test blog | [ ] |
| 7 | Social module | Calendar, social agent, approval inbox, publisher registry (X, LinkedIn via unified API) | E2E: post approved → published to a sandbox account | [ ] |
| 8 | Launch module | Directory database, launch kit generator, submission tracker | Launch kit generated for a sample product; tracker statuses update | [ ] |
| 9 | Analytics | Search Console + GA4/Plausible sources, analyst agent, weekly report | Report built correctly from recorded API data | [ ] |
| 10 | Orchestration | Strategist + reviewer agents, weekly loop jobs | Full-loop E2E test passes; evals meet thresholds | [ ] |
| 11 | Hardening for beta | Security review, rate limits, monitoring, eval thresholds, audit log | Beta checklist complete | [ ] |

## Prompt to start each step in Claude Code

```
Read CLAUDE.md and docs/BUILD_STEPS.md. We are on step <N>: <name>.
Enter plan mode and propose: the files and interfaces you'll create, how they follow SOLID,
and the list of tests (unit, contract, integration, E2E) you'll write first.
Wait for my approval before writing code. Then work test-first, and finish by running
pnpm test && pnpm typecheck && pnpm lint (plus test:int / test:e2e if relevant) and
summarizing results against the Definition of Done.
```
