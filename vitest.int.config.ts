import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "integration",
    include: ["{packages,apps}/*/test/**/*.int.test.ts"],
    globalSetup: ["packages/adapters/test/postgres/global-setup.ts"],
    // Files share one database and truncate it between tests, so they run one at a time.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "lcov"],
      reportsDirectory: "coverage/integration",
      include: [
        "packages/adapters/src/postgres/**/*.ts",
        "packages/adapters/src/billing/stripe-checkout-provider.ts",
        "packages/adapters/src/billing/stripe-setup.ts",
        "packages/adapters/src/anthropic/**/*.ts",
        "packages/adapters/src/crawler/http-site-crawler.ts",
        "packages/adapters/src/net/safe-http.ts",
        "packages/adapters/src/wordpress/wordpress-*.ts",
        "packages/adapters/src/wordpress/rest.ts",
        "packages/adapters/src/dataforseo/dataforseo-keyword-provider.ts",
        "packages/adapters/src/ayrshare/**/*.ts",
      ],
      exclude: ["**/*.test.ts"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
