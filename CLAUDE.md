# CLAUDE.md — LaunchPilot

LaunchPilot is an AI marketing app for SaaS founders: it reads a founder's SaaS, writes a Product Brief, and runs SEO content, launches/directories, social posting, and analytics on a weekly loop, with founder approval before anything is published.

These rules apply to every session. If a request conflicts with them, stop and ask.

## Non-negotiable rules

1. **One build step at a time.** Work only on the current step in `docs/BUILD_STEPS.md`. Never start the next step until the current one meets the Definition of Done and the user says "next step".
2. **Test first.** For every change: write a failing test (red) → make it pass (green) → refactor. No production code without a test that needed it.
3. **Everything green before you stop.** Before saying a task is done, run and paste the summary of:
   ```
   pnpm test && pnpm typecheck && pnpm lint
   ```
   If anything fails, fix it. Never skip, delete, or weaken a test to make it pass, and never use `.skip`, `.only`, `@ts-ignore`, or `eslint-disable` without the user's explicit approval.
4. **SOLID, always** (see below). If a change would violate a principle, propose a design that doesn't.
5. **Plan before code.** For any new step or feature, first list the files, interfaces, and tests you'll create, and wait for approval.

## Architecture (ports and adapters)

```
apps/web              Next.js UI + thin API routes (validate → call use case → return)
apps/worker           background jobs and schedules
packages/domain       entities, value objects, ContentItem state machine — NO I/O, NO framework imports
packages/ports        interfaces only
packages/application  use cases: orchestrate domain + ports, return Result — NO I/O, NO framework imports
packages/agents       strategist, seo, launch, social, analyst, reviewer — depend on ports only
packages/adapters     claude, dataforseo, ayrshare, cms, search-console, postgres — implement ports
packages/testing      fakes, fixtures, shared contract test suites
```

Dependency rule: `domain` ← `ports` ← `application` ← `agents` / `adapters` ← `apps`. Inner packages never import outer ones. `application`, `agents` and `adapters` may import only `domain` and `ports` (tests may also use `testing`). Concrete adapters are wired only in each app's composition root (`src/container.ts`). Enforced by ESLint `no-restricted-imports` and `tests/architecture.test.ts`.

## SOLID checklist

- **S — Single responsibility:** one reason to change per class/module. Route handlers contain no business logic. Agents draft OR review OR plan, never several.
- **O — Open/closed:** add behaviour by adding a class that implements a port and registering it (e.g. a new `Publisher` in `PublisherRegistry`), not by adding `if/switch` branches on channel type.
- **L — Liskov substitution:** every implementation of a port must pass that port's shared contract suite in `packages/testing/contracts/`. Add the contract test before the implementation.
- **I — Interface segregation:** keep ports small (`ContentDrafter`, `ContentReviewer`, `KeywordProvider`, `MetricsSource`, `LlmClient`, `Clock`, repositories). Split an interface when a consumer uses only part of it.
- **D — Dependency inversion:** depend on ports, inject via constructors. No `new SomeAdapter()` or SDK/database-driver import (e.g. `kysely`, `pg`, `stripe`) outside `adapters/` and composition roots. Time, randomness, and IDs come through injected ports so tests are deterministic.

## Testing

| Layer | Tool | Rules |
| --- | --- | --- |
| Unit | Vitest | Domain, use cases, agents with `FakeLlmClient`. No network, no DB. |
| Contract | Vitest shared suites | Every adapter runs the suite for its port. |
| Integration | Vitest + Testcontainers + MSW | Real Postgres; external HTTP via recorded responses. |
| E2E | Playwright | Critical journeys: onboarding, approve & publish, weekly report. |
| LLM evals | `pnpm eval` | Run when any prompt changes; scores must not drop below thresholds. |

Coverage thresholds (enforced in CI): `domain` and `agents` ≥ 90%, overall ≥ 80%.
Test names describe behaviour: `it("moves an approved item to scheduled when a publish time is set")`.

## Definition of Done (every step)

- [ ] Tests written first; full suite passes locally
- [ ] Coverage thresholds met
- [ ] `typecheck` and `lint` pass with zero warnings
- [ ] Feature works end to end (E2E test or documented manual check)
- [ ] No concrete adapter imported into `domain`, `ports`, or `agents`
- [ ] README / this file updated if conventions changed
- [ ] Summary posted: what was built, tests added, commands run and their results

## Product safety rules (enforced in code)

- Nothing reaches a public channel without `ContentItem.status === "approved"` by the founder.
- Reddit, Hacker News, and Indie Hackers content is draft-only; never implement auto-posting for them.
- Official platform APIs only: no scraping, no automated likes, follows, or DMs.
- Agents may only state product facts retrieved from the Product Brief or crawled site.
- OAuth tokens are encrypted at rest; never log secrets or tokens.

## Conventions

- TypeScript `strict`; no `any` (use `unknown` and narrow).
- Errors: return typed `Result<T, E>` from use cases; throw only for programmer errors.
- Validate all external input with Zod at the edges.
- Small files, small functions; prefer composition over inheritance.
- Conventional commits; one build step per branch and PR.

## Commands

```
pnpm install
pnpm test          # unit + contract
pnpm test:int      # integration (needs Docker)
pnpm test:e2e      # Playwright
pnpm eval          # LLM evals
pnpm typecheck
pnpm lint
```
