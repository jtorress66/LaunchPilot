// `pnpm test:e2e`: disposable Postgres and a real WordPress blog (Testcontainers) + migrations
// + a local fixture website and DataForSEO stub + Playwright with local billing and offline AI.
// Extra arguments are passed to Playwright, e.g. `pnpm test:e2e --project=desktop`.
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { startWordPress } from "./e2e-wordpress.mjs";

const SITE_PORT = 4010;
const fixtures = join(import.meta.dirname, "..", "apps", "web", "e2e", "fixtures");
const siteDir = join(fixtures, "site");
const DATAFORSEO_ROUTE = "/dataforseo/v3/dataforseo_labs/google/keyword_ideas/live";

/** Serves the "Acme Analytics" fixture site: `/` → index.html, `/pricing` → pricing.html. */
const startFixtureSite = () =>
  new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const path = new URL(req.url ?? "/", "http://site").pathname;
      // Recorded DataForSEO answer, so keyword research needs no paid account in E2E.
      if (req.method === "POST" && path === DATAFORSEO_ROUTE) {
        const body = await readFile(join(fixtures, "dataforseo", "keyword-ideas.json"));
        return res.writeHead(200, { "content-type": "application/json" }).end(body);
      }
      const file = path === "/robots.txt" ? "robots.txt" : `${path.slice(1) || "index"}.html`;
      if (!/^[a-z-]+\.(html|txt)$/.test(file)) return res.writeHead(404).end();
      try {
        const body = await readFile(join(siteDir, file));
        const type = file.endsWith(".txt") ? "text/plain" : "text/html; charset=utf-8";
        res.writeHead(200, { "content-type": type }).end(body);
      } catch {
        res.writeHead(404).end("Not found");
      }
    });
    server.listen(SITE_PORT, "127.0.0.1", () => resolve(server));
  });

// Asynchronous, so this process keeps serving the fixture site while Playwright runs.
const run = (command, args, env) =>
  new Promise((resolve) => {
    spawn(command, args, { stdio: "inherit", env: { ...process.env, ...env } }).on(
      "close",
      (code) => resolve(code ?? 1),
    );
  });

const site = await startFixtureSite();
const [container, wordpress] = await Promise.all([
  new PostgreSqlContainer("postgres:16-alpine").start(),
  startWordPress(),
]);
let status = 1;
try {
  const env = {
    DATABASE_URL: container.getConnectionUri(),
    APP_URL: "http://localhost:3000",
    APP_ENV: "test",
    BILLING_PROVIDER: "local",
    LOCAL_BILLING_SECRET: randomBytes(32).toString("hex"),
    TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    BRIEF_DRAFTER: "extractive",
    ARTICLE_WRITER: "template",
    KEYWORD_PROVIDER: "dataforseo",
    DATAFORSEO_LOGIN: "e2e",
    DATAFORSEO_PASSWORD: "e2e",
    DATAFORSEO_BASE_URL: `http://127.0.0.1:${SITE_PORT}/dataforseo`,
    ALLOW_PRIVATE_NETWORK: "true",
    E2E_SITE_URL: `http://127.0.0.1:${SITE_PORT}/`,
    ...wordpress.env,
  };
  status = await run("pnpm", ["--silent", "db:migrate"], env);
  if (status === 0)
    status = await run("pnpm", ["exec", "playwright", "test", ...process.argv.slice(2)], env);
} finally {
  await Promise.all([container.stop(), wordpress.stop()]);
  site.close();
}
process.exit(status);
