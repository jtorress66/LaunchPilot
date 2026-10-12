import { PublishDueContent, PublisherRegistry } from "@launchpilot/application";
import { BriefAgent, SeoArticleWriter, SocialPostWriter } from "@launchpilot/agents";
import {
  AesGcmTokenCipher,
  createPostgresRepositories,
  WordPressPublisherProvider,
  ZernioPublisherProvider,
  runZernioSmoke,
  DataForSeoKeywordProvider,
  ClaudeLlmClient,
  createDatabase,
  createStripeClient,
  ensureStripePrices,
  migrateToLatest,
  SystemClock,
} from "@launchpilot/adapters";
import type { DatabaseConfig, PublisherConfig, StripeSetupConfig, ZernioConfig } from "./config";
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

export const createKeywordProvider = ({
  login,
  password,
  baseUrl,
}: {
  login: string;
  password: string;
  baseUrl: string | undefined;
}) => new DataForSeoKeywordProvider({ login, password, ...(baseUrl ? { baseUrl } : {}) });

/** The SEO article writer's sibling for X and LinkedIn, metered for the social-post eval. */
export const createSocialEvalWriter = ({ apiKey, model }: EvalConfig) => {
  const meter = new MeteredLlmClient(new ClaudeLlmClient({ apiKey, model }));
  return { writer: new SocialPostWriter(meter), meter };
};

const zernioOptions = ({ apiKey, baseUrl }: ZernioConfig) => ({
  apiKey,
  clock: container.clock,
  ...(baseUrl === null ? {} : { baseUrl }),
});

/** The scheduled publish job over Postgres, with one publisher provider per channel. */
export const createPublishDue = (config: PublisherConfig) => {
  const db = createDatabase(config.connectionString);
  const repositories = createPostgresRepositories(db);
  const cipher = new AesGcmTokenCipher(config.tokenEncryptionKey);
  const zernio = zernioOptions(config.zernio);
  const publishers = new PublisherRegistry([
    new WordPressPublisherProvider(repositories.channelConnections, cipher, {
      allowPrivateNetwork: config.allowPrivateNetwork,
      clock: container.clock,
    }),
    new ZernioPublisherProvider("x", repositories.socialProfiles, zernio),
    new ZernioPublisherProvider("linkedin", repositories.socialProfiles, zernio),
  ]);
  return {
    publishDue: new PublishDueContent({
      contentItems: repositories.contentItems,
      tasks: repositories.tasks,
      publishers,
      clock: container.clock,
    }),
    close: () => db.destroy(),
  };
};

/** The CI smoke check: one real post to the test X account, then taken down. */
export const runSocialSmoke = (config: ZernioConfig, accountId: string, text: string) =>
  runZernioSmoke(zernioOptions(config), accountId, text);
