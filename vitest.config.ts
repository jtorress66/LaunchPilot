import { defineConfig } from "vitest/config";

const shared = {
  exclude: ["**/node_modules/**", "**/*.int.test.ts", "**/e2e/**"],
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          ...shared,
          name: "unit",
          include: [
            "{packages,apps}/*/src/**/*.test.ts",
            "packages/application/test/**/*.test.ts",
            "tests/**/*.test.ts",
          ],
        },
      },
      { test: { ...shared, name: "contract", include: ["packages/*/test/**/*.contract.test.ts"] } },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "html", "lcov"],
      include: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/index.ts",
        // Composition roots and framework entrypoints are exercised by E2E, not unit tests.
        "apps/*/src/container.ts",
        "apps/worker/src/main.ts",
        "apps/worker/src/migrate.ts",
        "apps/worker/src/stripe-setup.ts",
        // Calls real Claude; run by `pnpm eval` and its CI job. Its scoring logic is unit tested.
        "apps/worker/src/eval/run-brief-eval.ts",
        "apps/worker/src/eval/run-seo-eval.ts",
        // Calls the real DataForSEO API; run by its CI smoke job. The adapter is integration tested.
        "apps/worker/src/smoke/**",
        // Postgres code that only runs against a real database is measured by `pnpm test:int`.
        "packages/adapters/src/postgres/database.ts",
        "packages/adapters/src/postgres/migrate.ts",
        "packages/adapters/src/postgres/upsert.ts",
        "packages/adapters/src/postgres/migrations/**",
        "packages/adapters/src/postgres/repositories/**",
        "packages/adapters/src/billing/stripe-checkout-provider.ts",
        "packages/adapters/src/billing/stripe-setup.ts",
        // Only constructs the SDK client; exercised by the Stripe E2E job.
        "packages/adapters/src/billing/stripe-client.ts",
        // External HTTP adapters are measured by `pnpm test:int` against recorded responses and local servers.
        "packages/adapters/src/anthropic/**",
        "packages/adapters/src/crawler/http-site-crawler.ts",
        "packages/adapters/src/net/safe-http.ts",
        "packages/adapters/src/wordpress/wordpress-*.ts",
        "packages/adapters/src/wordpress/rest.ts",
        "packages/adapters/src/dataforseo/dataforseo-keyword-provider.ts",
        "packages/adapters/src/ayrshare/**",
        "apps/web/src/app/**",
        // Static marketing copy; rendered and asserted by the landing-page E2E suite.
        "apps/web/src/content/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        "packages/domain/src/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        "packages/application/src/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        "packages/agents/src/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        // Build step 2 gate: the ContentItem state machine is fully covered.
        "packages/domain/src/content-item/**": {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
    },
  },
});
