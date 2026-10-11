import { defineConfig, devices } from "@playwright/test";

/**
 * Real Stripe test-mode journey (CI job `e2e-stripe`). Needs a running app configured with
 * BILLING_PROVIDER=stripe and webhooks forwarded by `stripe listen`; see .github/workflows/ci.yml.
 */
export default defineConfig({
  testDir: "apps/web/e2e/stripe",
  timeout: 120_000,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
});
