import {
  AddToLaunch,
  ApproveLaunchKit,
  GenerateLaunchKit,
  GetLaunchOverview,
  ListDirectories,
  ReviseLaunchKit,
  UpdateSubmission,
  ApproveContentItem,
  ConnectBlog,
  ConnectSocial,
  DraftSocialWeek,
  GetInbox,
  GetSocialOverview,
  RefreshSocialLinks,
  SchedulePost,
  UnschedulePost,
  DraftSeoArticle,
  GetContentItem,
  GetSeoOverview,
  PlanSeoContent,
  PublishContentItem,
  PublisherRegistry,
  ReviseContentItem,
  ApproveBrief,
  AuthenticateSession,
  CreateProduct,
  GenerateBrief,
  GetBrief,
  ArchiveProduct,
  GetActivity,
  GetDashboard,
  GetProductLineup,
  RestoreProduct,
  SwapActiveProduct,
  HandleBillingWebhook,
  LogIn,
  LogOut,
  SignUp,
  StartCheckout,
  UpdateBrief,
  DrafterRegistry,
  GetAutopilotStatus,
  RunAutopilotNow,
  RunWeeklyLoop,
  SetAutopilot,
  SetProductLocale,
  ChooseAnalyticsProperties,
  CompleteGoogleConnect,
  ConnectPlausible,
  DisconnectAnalytics,
  GenerateWeeklyReport,
  GetAnalyticsOverview,
  GetWeeklyReport,
  ListAnalyticsProperties,
  MetricsSourceRegistry,
  StartGoogleConnect,
  WeeklyReportBuilder,
  AcceptInvitation,
  AddClient,
  GetBranding,
  GetInvitation,
  GetReportRecipients,
  InviteMember,
  ListClients,
  ListTeam,
  RemoveMember,
  SendReport,
  SwitchWorkspace,
  UpdateBranding,
} from "@nuvantre/application";
import {
  ReviewerAgent,
  StrategistAgent,
  TemplateReviewer,
  TemplateStrategist,
  AnalystAgent,
  TemplateAnalyst,
  BriefAgent,
  ExtractiveBriefDrafter,
  LaunchKitWriter,
  SeoArticleWriter,
  SocialPostWriter,
  TemplateLaunchKitWriter,
  TemplateArticleWriter,
  TemplatePostWriter,
} from "@nuvantre/agents";
import {
  AesGcmTokenCipher,
  createSentryErrorReporter,
  JsonLogErrorReporter,
  PostgresAuditTrail,
  PostgresRateLimiter,
  PostgresReadinessProbe,
  DataForSeoKeywordProvider,
  SeedKeywordProvider,
  BlogPublisherProvider,
  BlogVerifierRegistry,
  GhostConnectionVerifier,
  ghostPublisherFactory,
  ShopifyConnectionVerifier,
  shopifyPublisherFactory,
  WebflowConnectionVerifier,
  webflowPublisherFactory,
  WixConnectionVerifier,
  wixPublisherFactory,
  WordPressConnectionVerifier,
  wordPressPublisherFactory,
  ClaudeLlmClient,
  createDatabase,
  createPostgresRepositories,
  createStripeClient,
  HttpSiteCrawler,
  LocalCheckoutProvider,
  LocalCheckoutSimulator,
  LocalWebhookVerifier,
  RandomTokenGenerator,
  ScryptPasswordHasher,
  StripeCheckoutProvider,
  StripeWebhookVerifier,
  SystemClock,
  UuidIdGenerator,
  ZernioAccountLinker,
  ZernioPublisherProvider,
  Ga4Source,
  GoogleOAuthAuthorizer,
  GooglePropertyLister,
  googleStubUrls,
  PlausibleSource,
  PlausibleStatsVerifier,
  SearchConsoleSource,
  type GoogleOptions,
  LogMailer,
  ResendMailer,
  Sha256TokenHasher,
} from "@nuvantre/adapters";
import type { ErrorReporter, MetricsSource } from "@nuvantre/ports";
import {
  parseWebConfig,
  type ClaudeConfig,
  type GoogleConfig,
  type WebConfig,
} from "./server/config";
import { createRateGuard } from "./server/rate-limit";
import type { HealthHandlerDeps } from "./server/health-handler";

/** Composition root: the only place in the web app where concrete adapters are created. */
export const container = {
  clock: new SystemClock(),
  version: process.env.APP_VERSION ?? "0.1.0",
} satisfies HealthHandlerDeps;

/** The billing provider is chosen here, and only here, from validated configuration. */
const billingFor = (config: WebConfig) => {
  if (config.billing.provider === "stripe") {
    const stripe = createStripeClient(config.billing.secretKey);
    return {
      checkout: new StripeCheckoutProvider(stripe),
      verifier: new StripeWebhookVerifier(stripe, config.billing.webhookSecret),
      webhookSignatureHeader: "stripe-signature",
      localCheckout: null,
    };
  }
  return {
    checkout: new LocalCheckoutProvider(config.appUrl),
    verifier: new LocalWebhookVerifier(config.billing.secret),
    webhookSignatureHeader: LocalCheckoutSimulator.signatureHeader,
    localCheckout: new LocalCheckoutSimulator(config.appUrl, config.billing.secret),
  };
};

const claudeClient = ({ apiKey, model }: ClaudeConfig) => new ClaudeLlmClient({ apiKey, model });

/** Claude drafts briefs and articles in production; offline stand-ins exist for development and test only. */
const briefDrafterFor = ({ drafter }: WebConfig["brief"]) =>
  drafter.kind === "claude" ? new BriefAgent(claudeClient(drafter)) : new ExtractiveBriefDrafter();

const articleWriterFor = ({ writer }: WebConfig["seo"]) =>
  writer.kind === "claude"
    ? new SeoArticleWriter(claudeClient(writer))
    : new TemplateArticleWriter();

const socialWriterFor = ({ writer }: WebConfig["social"]) =>
  writer.kind === "claude" ? new SocialPostWriter(claudeClient(writer)) : new TemplatePostWriter();

const launchWriterFor = ({ writer }: WebConfig["launch"]) =>
  writer.kind === "claude"
    ? new LaunchKitWriter(claudeClient(writer))
    : new TemplateLaunchKitWriter();

const zernioOptionsFor = ({ zernio }: WebConfig["social"]) => ({
  apiKey: zernio.apiKey,
  clock: container.clock,
  ...(zernio.baseUrl === null ? {} : { baseUrl: zernio.baseUrl }),
});

const keywordProviderFor = ({ keywords }: WebConfig["seo"]) =>
  keywords.kind === "dataforseo"
    ? new DataForSeoKeywordProvider({
        login: keywords.login,
        password: keywords.password,
        ...(keywords.baseUrl === null ? {} : { baseUrl: keywords.baseUrl }),
      })
    : new SeedKeywordProvider();

const analystFor = ({ analyst }: WebConfig["analytics"]) =>
  analyst.kind === "claude" ? new AnalystAgent(claudeClient(analyst)) : new TemplateAnalyst();

const googleOptionsFor = ({ clientId, clientSecret, baseUrl }: GoogleConfig): GoogleOptions => ({
  clientId,
  clientSecret,
  ...(baseUrl === null ? {} : { urls: googleStubUrls(baseUrl) }),
});

/** Postgres repositories plus the hardening stores: audit trail, rate limits, readiness. */
const repositoriesFor = (config: WebConfig) => {
  const db = createDatabase(config.databaseUrl);
  return {
    ...createPostgresRepositories(db),
    audit: new PostgresAuditTrail(db),
    limiter: new PostgresRateLimiter(db, container.clock),
    readiness: new PostgresReadinessProbe(db),
    errors: errorReporterFor(config),
  };
};

/** Resend from the verified address, or (development and test) one log line per email. */
const mailerFor = ({ mail }: WebConfig) =>
  mail.kind === "resend"
    ? new ResendMailer({
        apiKey: mail.apiKey,
        from: mail.from,
        ...(mail.baseUrl === undefined ? {} : { baseUrl: mail.baseUrl }),
      })
    : new LogMailer((line) => {
        process.stdout.write(`${line}\n`);
      });

/** Sentry when SENTRY_DSN is set, else one scrubbed JSON line per unexpected error. */
const errorReporterFor = ({ monitoring }: WebConfig): ErrorReporter =>
  monitoring.sentry
    ? createSentryErrorReporter(monitoring.sentry)
    : new JsonLogErrorReporter((line) => {
        process.stderr.write(`${line}\n`);
      });

type Repositories = ReturnType<typeof repositoriesFor>;

/**
 * Analytics wiring. Google's sources and connect flow exist only when an OAuth client is
 * configured; Plausible always does. A new source is one more registration here.
 */
const analyticsFor = (
  config: WebConfig,
  repositories: Repositories,
  cipher: AesGcmTokenCipher,
  base: {
    readonly clock: SystemClock;
    readonly ids: UuidIdGenerator;
    readonly tokens: RandomTokenGenerator;
  },
) => {
  const google = config.analytics.google && googleOptionsFor(config.analytics.google);
  const sources: MetricsSource[] = [];
  if (google) {
    sources.push(
      new SearchConsoleSource(repositories.analyticsConnections, cipher, google),
      new Ga4Source(repositories.analyticsConnections, cipher, google),
    );
  }
  sources.push(
    new PlausibleSource(repositories.analyticsConnections, cipher, {
      allowPrivateNetwork: config.allowPrivateNetwork,
    }),
  );
  const deps = {
    ...repositories,
    ...base,
    cipher,
    appUrl: config.appUrl,
    plausibleVerifier: new PlausibleStatsVerifier({
      allowPrivateNetwork: config.allowPrivateNetwork,
    }),
  };
  const builder = new WeeklyReportBuilder({
    ...deps,
    metricsSources: new MetricsSourceRegistry(sources),
    analyst: analystFor(config.analytics),
  });
  const googleDeps = google && {
    ...deps,
    googleAuth: new GoogleOAuthAuthorizer(google),
    propertyLister: new GooglePropertyLister(google),
  };
  return {
    google: googleDeps && {
      start: new StartGoogleConnect(googleDeps),
      complete: new CompleteGoogleConnect(googleDeps),
      listProperties: new ListAnalyticsProperties(googleDeps),
      chooseProperties: new ChooseAnalyticsProperties(googleDeps),
    },
    connectPlausible: new ConnectPlausible(deps),
    disconnect: new DisconnectAnalytics(deps),
    generateReport: new GenerateWeeklyReport({ ...deps, builder }),
    getOverview: new GetAnalyticsOverview(deps),
    getReport: new GetWeeklyReport(deps),
  };
};

const strategistFor = ({ strategist }: WebConfig["autopilot"]) =>
  strategist.kind === "claude"
    ? new StrategistAgent(claudeClient(strategist))
    : new TemplateStrategist();

const reviewerFor = ({ reviewer }: WebConfig["autopilot"]) =>
  reviewer.kind === "claude" ? new ReviewerAgent(claudeClient(reviewer)) : new TemplateReviewer();

/** Each blog platform's API address: the real one, or a local stand-in in development and test. */
const blogNetworks = (config: WebConfig) => {
  const network = { allowPrivateNetwork: config.allowPrivateNetwork, clock: container.clock };
  const { webflowApiBaseUrl, wixApiBaseUrl } = config.blogs;
  return {
    network,
    webflow: { ...network, ...(webflowApiBaseUrl ? { apiBaseUrl: webflowApiBaseUrl } : {}) },
    wix: { ...network, ...(wixApiBaseUrl ? { apiBaseUrl: wixApiBaseUrl } : {}) },
  };
};

/** One verifier per blog platform: adding a platform means registering its verifier here. */
const blogVerifierFor = (config: WebConfig) => {
  const blogs = blogNetworks(config);
  return new BlogVerifierRegistry({
    wordpress: new WordPressConnectionVerifier(blogs.network),
    ghost: new GhostConnectionVerifier(blogs.network),
    shopify: new ShopifyConnectionVerifier(blogs.network),
    webflow: new WebflowConnectionVerifier(blogs.webflow),
    wix: new WixConnectionVerifier(blogs.wix),
  });
};

/** One publisher factory per blog platform, chosen by the product's stored connection. */
const blogPublishersFor = (config: WebConfig) => {
  const blogs = blogNetworks(config);
  return {
    wordpress: wordPressPublisherFactory(blogs.network),
    ghost: ghostPublisherFactory(blogs.network),
    shopify: shopifyPublisherFactory(blogs.network),
    webflow: webflowPublisherFactory(blogs.webflow),
    wix: wixPublisherFactory(blogs.wix),
  };
};

const build = (config: WebConfig) => {
  const billing = billingFor(config);
  const repositories = repositoriesFor(config);
  const network = { allowPrivateNetwork: config.allowPrivateNetwork };
  const cipher = new AesGcmTokenCipher(config.tokenEncryptionKey);
  const zernio = zernioOptionsFor(config.social);
  const deps = {
    ...repositories,
    ...billing,
    connections: repositories.channelConnections,
    crawler: new HttpSiteCrawler(network),
    drafter: briefDrafterFor(config.brief),
    writer: articleWriterFor(config.seo),
    keywords: keywordProviderFor(config.seo),
    cipher,
    blogVerifier: blogVerifierFor(config),
    socialWriter: socialWriterFor(config.social),
    launchWriter: launchWriterFor(config.launch),
    linker: new ZernioAccountLinker(zernio),
    // One provider per channel: adding a channel means registering its provider here.
    publishers: new PublisherRegistry([
      new BlogPublisherProvider(repositories.channelConnections, cipher, blogPublishersFor(config)),
      new ZernioPublisherProvider("x", repositories.socialProfiles, zernio),
      new ZernioPublisherProvider("linkedin", repositories.socialProfiles, zernio),
    ]),
    clock: container.clock,
    ids: new UuidIdGenerator(),
    tokens: new RandomTokenGenerator(),
    hasher: new ScryptPasswordHasher(),
    tokenHasher: new Sha256TokenHasher(),
    mailer: mailerFor(config),
    appUrl: config.appUrl,
  };
  // The weekly loop drafts with the same writers as the SEO and Social pages: one per channel.
  const loop = new RunWeeklyLoop({
    ...deps,
    planner: strategistFor(config.autopilot),
    reviewer: reviewerFor(config.autopilot),
    drafters: new DrafterRegistry([
      { channel: "blog", drafter: deps.writer },
      { channel: "x", drafter: deps.socialWriter },
      { channel: "linkedin", drafter: deps.socialWriter },
    ]),
  });
  return {
    appUrl: config.appUrl,
    trustProxy: config.hardening.trustProxy,
    rateGuard: createRateGuard({
      limiter: repositories.limiter,
      overrides: config.hardening.rateLimitOverrides,
    }),
    errors: repositories.errors,
    readiness: [repositories.readiness],
    getActivity: new GetActivity(deps),
    webhookSignatureHeader: billing.webhookSignatureHeader,
    localCheckout: billing.localCheckout,
    signUp: new SignUp(deps),
    logIn: new LogIn(deps),
    logOut: new LogOut(deps),
    authenticate: new AuthenticateSession(deps),
    createProduct: new CreateProduct(deps),
    getDashboard: new GetDashboard(deps),
    getProductLineup: new GetProductLineup(deps),
    archiveProduct: new ArchiveProduct(deps),
    restoreProduct: new RestoreProduct(deps),
    swapActiveProduct: new SwapActiveProduct(deps),
    startCheckout: new StartCheckout(deps),
    handleBillingWebhook: new HandleBillingWebhook(deps),
    generateBrief: new GenerateBrief(deps),
    getBrief: new GetBrief(deps),
    updateBrief: new UpdateBrief(deps),
    approveBrief: new ApproveBrief(deps),
    connectBlog: new ConnectBlog(deps),
    planSeoContent: new PlanSeoContent(deps),
    draftSeoArticle: new DraftSeoArticle(deps),
    reviseContentItem: new ReviseContentItem(deps),
    approveContentItem: new ApproveContentItem(deps),
    publishContentItem: new PublishContentItem(deps),
    getSeoOverview: new GetSeoOverview(deps),
    getContentItem: new GetContentItem(deps),
    connectSocial: new ConnectSocial(deps),
    refreshSocialLinks: new RefreshSocialLinks(deps),
    draftSocialWeek: new DraftSocialWeek(deps),
    schedulePost: new SchedulePost(deps),
    unschedulePost: new UnschedulePost(deps),
    getInbox: new GetInbox(deps),
    getSocialOverview: new GetSocialOverview(deps),
    generateLaunchKit: new GenerateLaunchKit(deps),
    reviseLaunchKit: new ReviseLaunchKit(deps),
    approveLaunchKit: new ApproveLaunchKit(deps),
    listDirectories: new ListDirectories(deps),
    addToLaunch: new AddToLaunch(deps),
    updateSubmission: new UpdateSubmission(deps),
    getLaunchOverview: new GetLaunchOverview(deps),
    analytics: analyticsFor(config, repositories, cipher, deps),
    setAutopilot: new SetAutopilot(deps),
    setProductLocale: new SetProductLocale(deps),
    runAutopilotNow: new RunAutopilotNow({ ...deps, loop }),
    getAutopilotStatus: new GetAutopilotStatus(deps),
    switchWorkspace: new SwitchWorkspace(deps),
    addClient: new AddClient(deps),
    listClients: new ListClients(deps),
    inviteMember: new InviteMember(deps),
    getInvitation: new GetInvitation(deps),
    acceptInvitation: new AcceptInvitation(deps),
    listTeam: new ListTeam(deps),
    removeMember: new RemoveMember(deps),
    getBranding: new GetBranding(deps),
    updateBranding: new UpdateBranding(deps),
    sendReport: new SendReport(deps),
    getReportRecipients: new GetReportRecipients(deps),
  };
};

export type AppContainer = ReturnType<typeof build>;

// Cached on globalThis so dev-server reloads reuse one connection pool.
const cache = globalThis as { nuvantreApp?: AppContainer };

/** Builds the app on first use, so `next build` never needs runtime secrets. */
export const getAppContainer = (): AppContainer => {
  if (cache.nuvantreApp) return cache.nuvantreApp;
  const config = parseWebConfig(process.env);
  if (!config.ok) throw new Error(`Invalid configuration: ${config.error}`);
  cache.nuvantreApp = build(config.value);
  return cache.nuvantreApp;
};
