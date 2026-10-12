import { PublishDueContent, PublisherRegistry } from "@launchpilot/application";
import { BriefAgent, SeoArticleWriter, SocialPostWriter } from "@launchpilot/agents";
import {
  AesGcmTokenCipher,
  runAyrshareSmoke,
  AyrsharePublisherProvider,
  createPostgresRepositories,
  WordPressPublisherProvider,
  DataForSeoKeywordProvider,
  ClaudeLlmClient,
  createDatabase,
  createStripeClient,
  ensureStripePrices,
  migrateToLatest,
  SystemClock,
} from "@launchpilot/adapters";
import type { AyrshareConfig, DatabaseConfig, PublisherConfig, StripeSetupConfig } from "./config";
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

const ayrshareOptions = (config: AyrshareConfig) => ({
  apiKey: config.apiKey,
  domain: config.domain,
  privateKey: config.privateKey,
  clock: container.clock,
  ...(config.baseUrl === null ? {} : { baseUrl: config.baseUrl }),
  ...(config.xCredentials === null ? {} : { xCredentials: config.xCredentials }),
});

/** The scheduled publish job over Postgres, with one publisher provider per channel. */
export const createPublishDue = (config: PublisherConfig) => {
  const db = createDatabase(config.connectionString);
  const repositories = createPostgresRepositories(db);
  const cipher = new AesGcmTokenCipher(config.tokenEncryptionKey);
  const ayrshare = ayrshareOptions(config.ayrshare);
  const publishers = new PublisherRegistry([
    new WordPressPublisherProvider(repositories.channelConnections, cipher, {
      allowPrivateNetwork: config.allowPrivateNetwork,
      clock: container.clock,
    }),
    new AyrsharePublisherProvider("x", repositories.socialProfiles, cipher, ayrshare),
    new AyrsharePublisherProvider("linkedin", repositories.socialProfiles, cipher, ayrshare),
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

/** The CI smoke check: one real post to the test profile's X account, then deleted. */
export const runSocialSmoke = (
  { apiKey, xCredentials }: { apiKey: string; xCredentials: AyrshareConfig["xCredentials"] },
  profileKey: string,
  text: string,
) =>
  // Linking is not exercised, so the JWT domain and private key are not needed.
  runAyrshareSmoke(
    ayrshareOptions({ apiKey, domain: "", privateKey: "", baseUrl: null, xCredentials }),
    profileKey,
    text,
  );
