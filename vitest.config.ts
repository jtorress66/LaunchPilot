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
          include: ["{packages,apps}/*/src/**/*.test.ts", "tests/**/*.test.ts"],
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
        "packages/agents/src/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
