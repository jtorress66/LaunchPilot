import {
  DrafterRegistry,
  RunDueLoops,
  RunWeeklyLoop,
  BuildDueReports,
  MetricsSourceRegistry,
  PublishDueContent,
  PublisherRegistry,
  WeeklyReportBuilder,
} from "@nuvantre/application";
import {
  ReviewerAgent,
  StrategistAgent,
  TemplateArticleWriter,
  TemplatePostWriter,
  TemplateReviewer,
  TemplateStrategist,
  AnalystAgent,
  TemplateAnalyst,
  BriefAgent,
  LaunchKitWriter,
  SeoArticleWriter,
  SocialPostWriter,
} from "@nuvantre/agents";
import {
  AesGcmTokenCipher,
  createPostgresRepositories,
  BlogPublisherProvider,
  createSentryErrorReporter,
  JsonLogErrorReporter,
  PostgresAuditTrail,
  PostgresJobLock,
  PostgresRateLimiter,
  BlogVerifierRegistry,
  GhostConnectionVerifier,
  ShopifyConnectionVerifier,
  WebflowConnectionVerifier,
  WixConnectionVerifier,
  WordPressConnectionVerifier,
  ghostPublisherFactory,
  shopifyPublisherFactory,
  webflowPublisherFactory,
  wixPublisherFactory,
  wordPressPublisherFactory,
  ZernioPublisherProvider,
  runZernioSmoke,
  assessZernioChange,
  fetchZernioChangelog,
  DataForSeoKeywordProvider,
  ClaudeLlmClient,
  createDatabase,
  createStripeClient,
  ensureStripePrices,
  migrateToLatest,
  loadSeedDirectories,
  syncDirectories,
  SystemClock,
  DEFAULT_CLAUDE_MODEL,
  Ga4Source,
  googleStubUrls,
  PlausibleSource,
  SearchConsoleSource,
  UuidIdGenerator,
  type GoogleOptions,
  SeedKeywordProvider,
} from "@nuvantre/adapters";
import type {
  BlogCredentials,
  Clock,
  ErrorReporter,
  MetricsSource,
  TokenCipher,
} from "@nuvantre/ports";
import type {
  AnalystConfig,
  DatabaseConfig,
  GoogleConfig,
  LoopConfig,
  MonitoringConfig,
  PublisherConfig,
  ReportsConfig,
  StripeSetupConfig,
  ZernioConfig,
} from "./config";
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

/**
 * Opens a single connection, applies pending migrations, syncs the curated directory catalogue
 * and closes the connection again.
 */
export const runMigrations = async ({ connectionString }: DatabaseConfig) => {
  const db = createDatabase(connectionString, 1);
  try {
    const migrated = await migrateToLatest(db);
    if (!migrated.ok) return migrated;
    const seed = loadSeedDirectories();
    if (!seed.ok) return seed;
    const directories = await syncDirectories(db, seed.value);
    return { ok: true as const, value: { ...migrated.value, directories } };
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

/** The analyst on real Claude, metered for the analyst eval. */
export const createAnalystEvalAgent = ({ apiKey, model }: EvalConfig) => {
  const meter = new MeteredLlmClient(new ClaudeLlmClient({ apiKey, model }));
  return { analyst: new AnalystAgent(meter), meter };
};

/** The strategist on real Claude, metered for the strategist eval. */
export const createStrategistEvalAgent = ({ apiKey, model }: EvalConfig) => {
  const meter = new MeteredLlmClient(new ClaudeLlmClient({ apiKey, model }));
  return { strategist: new StrategistAgent(meter), meter };
};

/** The reviewer on real Claude, metered for the reviewer eval. */
export const createReviewerEvalAgent = ({ apiKey, model }: EvalConfig) => {
  const meter = new MeteredLlmClient(new ClaudeLlmClient({ apiKey, model }));
  return { reviewer: new ReviewerAgent(meter), meter };
};

/** The launch kit writer on real Claude, metered for the launch-kit eval. */
export const createLaunchEvalWriter = ({ apiKey, model }: EvalConfig) => {
  const meter = new MeteredLlmClient(new ClaudeLlmClient({ apiKey, model }));
  return { writer: new LaunchKitWriter(meter), meter };
};

const zernioOptions = ({ apiKey, baseUrl }: ZernioConfig) => ({
  apiKey,
  clock: container.clock,
  ...(baseUrl === null ? {} : { baseUrl }),
});

/** One publisher factory per blog platform, chosen by the product's stored connection. */
const blogPublishersFor = ({ allowPrivateNetwork, blogs }: PublisherConfig) => {
  const network = { allowPrivateNetwork, clock: container.clock };
  const { webflowApiBaseUrl, wixApiBaseUrl } = blogs;
  return {
    wordpress: wordPressPublisherFactory(network),
    ghost: ghostPublisherFactory(network),
    shopify: shopifyPublisherFactory(network),
    webflow: webflowPublisherFactory({
      ...network,
      ...(webflowApiBaseUrl ? { apiBaseUrl: webflowApiBaseUrl } : {}),
    }),
    wix: wixPublisherFactory({
      ...network,
      ...(wixApiBaseUrl ? { apiBaseUrl: wixApiBaseUrl } : {}),
    }),
  };
};

/** The scheduled publish job over Postgres, with one publisher provider per channel. */
/** Sentry when configured, else one scrubbed JSON line per error. */
export const createErrorReporter = ({ sentry }: MonitoringConfig): ErrorReporter =>
  sentry ? createSentryErrorReporter(sentry) : new JsonLogErrorReporter(container.log);

/**
 * What every scheduled job runs with: an advisory lock per job, so a second worker skips work
 * already running, and error reporting. Also the rate-limit table the purge job keeps small.
 */
export const createJobRuntime = (connectionString: string, errors: ErrorReporter) => {
  const db = createDatabase(connectionString);
  return {
    runtime: { log: container.log, errors, lock: new PostgresJobLock(db), clock: container.clock },
    limits: new PostgresRateLimiter(db, container.clock),
    close: () => db.destroy(),
  };
};

export const createPublishDue = (config: PublisherConfig, errors: ErrorReporter) => {
  const db = createDatabase(config.connectionString);
  const repositories = createPostgresRepositories(db);
  const cipher = new AesGcmTokenCipher(config.tokenEncryptionKey);
  const zernio = zernioOptions(config.zernio);
  const publishers = new PublisherRegistry([
    new BlogPublisherProvider(repositories.channelConnections, cipher, blogPublishersFor(config)),
    new ZernioPublisherProvider("x", repositories.socialProfiles, zernio),
    new ZernioPublisherProvider("linkedin", repositories.socialProfiles, zernio),
  ]);
  return {
    publishDue: new PublishDueContent({
      contentItems: repositories.contentItems,
      products: repositories.products,
      subscriptions: repositories.subscriptions,
      tasks: repositories.tasks,
      publishers,
      clock: container.clock,
      audit: new PostgresAuditTrail(db),
      errors,
      ids: new UuidIdGenerator(),
    }),
    close: () => db.destroy(),
  };
};

/** The CI smoke check against the real API: read-only, it never posts. */
/** The read-only connect check against real blog platforms, as founders' keys would be checked. */
export const runBlogSmoke = (credentials: BlogCredentials) => {
  const network = { allowPrivateNetwork: false, clock: container.clock };
  return new BlogVerifierRegistry({
    wordpress: new WordPressConnectionVerifier(network),
    ghost: new GhostConnectionVerifier(network),
    shopify: new ShopifyConnectionVerifier(network),
    webflow: new WebflowConnectionVerifier(network),
    wix: new WixConnectionVerifier(network),
  }).verify(credentials);
};

export const runSocialSmoke = (config: ZernioConfig) => runZernioSmoke(zernioOptions(config));

/** Zernio changelog entries since `since` that affect the integration, with the reasons. */
export const findAffectingZernioChanges = async (since: Date) => {
  const entries = await fetchZernioChangelog({ since });
  if (!entries.ok) return entries;
  return {
    ok: true as const,
    value: entries.value.flatMap((entry) => {
      const { affected, reasons } = assessZernioChange(entry);
      return affected ? [{ ...entry, reasons }] : [];
    }),
  };
};

const googleOptions = ({ clientId, clientSecret, baseUrl }: GoogleConfig): GoogleOptions => ({
  clientId,
  clientSecret,
  ...(baseUrl === null ? {} : { urls: googleStubUrls(baseUrl) }),
});

const analystOf = (config: AnalystConfig) =>
  config.kind === "claude"
    ? new AnalystAgent(
        new ClaudeLlmClient({ apiKey: config.apiKey, model: config.model ?? DEFAULT_CLAUDE_MODEL }),
      )
    : new TemplateAnalyst();

/** Every analytics source this deployment can read; Google ones only when Google is configured. */
const metricsSources = (
  repositories: ReturnType<typeof createPostgresRepositories>,
  cipher: TokenCipher,
  publisher: PublisherConfig,
  reports: ReportsConfig,
) => {
  const sources: MetricsSource[] = [];
  if (reports.google !== null) {
    const options = googleOptions(reports.google);
    sources.push(
      new SearchConsoleSource(repositories.analyticsConnections, cipher, options),
      new Ga4Source(repositories.analyticsConnections, cipher, options),
    );
  }
  sources.push(
    new PlausibleSource(repositories.analyticsConnections, cipher, {
      allowPrivateNetwork: publisher.allowPrivateNetwork,
    }),
  );
  return new MetricsSourceRegistry(sources);
};

/** The weekly report job over Postgres, with the real analytics sources and analyst. */
export const createWeeklyReports = (publisher: PublisherConfig, reports: ReportsConfig) => {
  const db = createDatabase(publisher.connectionString);
  const repositories = createPostgresRepositories(db);
  const cipher = new AesGcmTokenCipher(publisher.tokenEncryptionKey);
  const builder = new WeeklyReportBuilder({
    briefs: repositories.briefs,
    metricsSources: metricsSources(repositories, cipher, publisher, reports),
    analyst: analystOf(reports.analyst),
    weeklyReports: repositories.weeklyReports,
    ids: new UuidIdGenerator(),
    clock: container.clock,
  });
  return {
    builder,
    buildDue: new BuildDueReports({
      products: repositories.products,
      subscriptions: repositories.subscriptions,
      analyticsConnections: repositories.analyticsConnections,
      weeklyReports: repositories.weeklyReports,
      builder,
      clock: container.clock,
    }),
    close: () => db.destroy(),
  };
};

const claudeFor = (config: LoopConfig) => {
  if (config.claude === null) throw new Error("An agent uses Claude but no API key is configured");
  return new ClaudeLlmClient({
    apiKey: config.claude.apiKey,
    model: config.claude.model ?? DEFAULT_CLAUDE_MODEL,
  });
};

/** One agent per role, Claude or its offline template, as the configuration chose. */
const loopAgents = (config: LoopConfig) => {
  const llm = () => claudeFor(config);
  const { agents } = config;
  const articleWriter =
    agents.articleWriter === "claude" ? new SeoArticleWriter(llm()) : new TemplateArticleWriter();
  const socialWriter =
    agents.socialWriter === "claude" ? new SocialPostWriter(llm()) : new TemplatePostWriter();
  return {
    planner: agents.strategist === "claude" ? new StrategistAgent(llm()) : new TemplateStrategist(),
    reviewer: agents.reviewer === "claude" ? new ReviewerAgent(llm()) : new TemplateReviewer(),
    // One writer per channel: a new channel is one more registration here.
    drafters: new DrafterRegistry([
      { channel: "blog", drafter: articleWriter },
      { channel: "x", drafter: socialWriter },
      { channel: "linkedin", drafter: socialWriter },
    ]),
    keywords:
      config.keywords.kind === "dataforseo"
        ? createKeywordProvider({
            login: config.keywords.login,
            password: config.keywords.password,
            baseUrl: config.keywords.baseUrl ?? undefined,
          })
        : new SeedKeywordProvider(),
  };
};

/** The weekly autopilot job over Postgres. The clock is injectable so tests can pick a Monday. */
export const createWeeklyLoop = (
  publisher: PublisherConfig,
  config: LoopConfig,
  clock: Clock = container.clock,
) => {
  const db = createDatabase(publisher.connectionString);
  const repositories = createPostgresRepositories(db);
  const loop = new RunWeeklyLoop({
    ...repositories,
    ...loopAgents(config),
    ids: new UuidIdGenerator(),
    clock,
  });
  return {
    runDue: new RunDueLoops({ ...repositories, loop, clock }),
    close: () => db.destroy(),
  };
};
