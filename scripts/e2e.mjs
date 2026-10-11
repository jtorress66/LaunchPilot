// `pnpm test:e2e`: disposable Postgres (Testcontainers) + migrations + Playwright with local billing.
// Extra arguments are passed to Playwright, e.g. `pnpm test:e2e --project=desktop`.
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

const run = (command, args, env) =>
  spawnSync(command, args, { stdio: "inherit", env: { ...process.env, ...env } }).status ?? 1;

const container = await new PostgreSqlContainer("postgres:16-alpine").start();
let status = 1;
try {
  const env = {
    DATABASE_URL: container.getConnectionUri(),
    APP_URL: "http://localhost:3000",
    APP_ENV: "test",
    BILLING_PROVIDER: "local",
    LOCAL_BILLING_SECRET: randomBytes(32).toString("hex"),
  };
  status = run("pnpm", ["--silent", "db:migrate"], env);
  if (status === 0)
    status = run("pnpm", ["exec", "playwright", "test", ...process.argv.slice(2)], env);
} finally {
  await container.stop();
}
process.exit(status);
