import { BriefAgent, SeoArticleWriter } from "@launchpilot/agents";
import {
  DataForSeoKeywordProvider,
  ClaudeLlmClient,
  createDatabase,
  createStripeClient,
  ensureStripePrices,
  migrateToLatest,
  SystemClock,
} from "@launchpilot/adapters";
import type { DatabaseConfig, StripeSetupConfig } from "./config";
import type { EvalConfig } from "./eval/brief-eval";
import { MeteredLlmClient } from "./eval/metered-llm-client";
import type { HeartbeatDeps } from "./heartbeat";

/** Composition root: the only place in the worker where concrete adapters are created. */
export const container = {
  clock: new SystemClock(),
  version: process.env.APP_VERSION ?? "0.1.0",
  log: (line: string) => {
    process.stdout.write(`${line}\n`);
  },
} satisfies HeartbeatDeps;

/** Opens a single connection, applies pending migrations and closes it again. */
export const runMigrations = async ({ connectionString }: DatabaseConfig) => {
  const db = createDatabase(connectionString, 1);
  try {
    return await migrateToLatest(db);
  } finally {
    await db.destroy();
  }
};

export const runStripeSetup = ({ secretKey }: StripeSetupConfig) =>
  ensureStripePrices(createStripeClient(secretKey));

/** The brief agent on real Claude, metered so `pnpm eval` can report usage and cost. */
export const createBriefEvalAgent = ({ apiKey, model }: EvalConfig) => {
  const meter = new MeteredLlmClient(new ClaudeLlmClient({ apiKey, model }));
  return { agent: new BriefAgent(meter), meter };
};

/** The SEO article writer on real Claude, metered for the seo-article eval. */
export const createSeoEvalWriter = ({ apiKey, model }: EvalConfig) => {
  const meter = new MeteredLlmClient(new ClaudeLlmClient({ apiKey, model }));
  return { writer: new SeoArticleWriter(meter), meter };
};

export const createKeywordProvider = (credentials: { login: string; password: string }) =>
  new DataForSeoKeywordProvider(credentials);
