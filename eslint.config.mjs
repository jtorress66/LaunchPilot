// @ts-check
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import vitest from "@vitest/eslint-plugin";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Dependency rule: domain ← ports ← application ← agents / adapters ← apps.
 * Each layer lists the internal packages it must never import.
 * Concrete adapters are wired only in apps' composition roots (src/container.ts).
 */
const forbid = (packages, extraPatterns = []) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        ...packages.map((name) => ({
          group: [`@launchpilot/${name}`, `@launchpilot/${name}/*`],
          message: `This layer must not depend on @launchpilot/${name} (see CLAUDE.md dependency rule).`,
        })),
        ...extraPatterns,
      ],
    },
  ],
});

/** Inner layers stay pure: no frameworks, SDKs, or Node I/O. */
const noFrameworksOrIo = [
  {
    group: [
      "next",
      "next/*",
      "react",
      "react-dom",
      "pg",
      "kysely",
      "stripe",
      "@anthropic-ai/*",
      "node:*",
      "fs",
      "http",
      "https",
    ],
    message: "Inner layers must not import frameworks, SDKs, or I/O modules.",
  },
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/next-env.d.ts",
    ],
  },
  { linterOptions: { reportUnusedDisableDirectives: "error" } },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": true, "ts-nocheck": true, "ts-expect-error": "allow-with-description" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    files: ["**/*.mjs", "**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "packages/testing/contracts/**/*.ts"],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/no-focused-tests": "error",
      "vitest/no-disabled-tests": "error",
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    settings: { next: { rootDir: "apps/web" } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    files: ["packages/domain/**/*.ts"],
    rules: forbid(
      ["ports", "application", "agents", "adapters", "testing", "web", "worker"],
      noFrameworksOrIo,
    ),
  },
  {
    files: ["packages/ports/**/*.ts"],
    rules: forbid(
      ["application", "agents", "adapters", "testing", "web", "worker"],
      noFrameworksOrIo,
    ),
  },
  {
    // Tests in application and agents may use fakes from @launchpilot/testing.
    files: ["packages/application/src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: forbid(["agents", "adapters", "testing", "web", "worker"], noFrameworksOrIo),
  },
  {
    files: ["packages/agents/src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: forbid(["application", "adapters", "testing", "web", "worker"], noFrameworksOrIo),
  },
  {
    files: ["packages/testing/**/*.ts"],
    rules: forbid(["application", "agents", "adapters", "web", "worker"], noFrameworksOrIo),
  },
  {
    files: ["packages/adapters/src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: forbid(["application", "agents", "testing", "web", "worker"]),
  },
  {
    // Production app code may only reach concrete adapters through the composition root.
    files: ["apps/*/src/**/*.{ts,tsx}"],
    ignores: ["apps/*/src/container.ts", "apps/*/src/**/*.test.ts"],
    rules: forbid(["adapters", "testing"]),
  },
  {
    files: ["apps/web/e2e/**/*.ts", "playwright.config.ts"],
    rules: {
      // Playwright fixtures use empty object destructuring patterns by convention.
      "no-empty-pattern": "off",
    },
  },
  prettier,
);
