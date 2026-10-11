import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "integration",
    include: ["{packages,apps}/*/test/**/*.int.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
