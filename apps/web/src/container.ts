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
  GetDashboard,
  HandleBillingWebhook,
  LogIn,
  LogOut,
  SignUp,
  StartCheckout,
  UpdateBrief,
} from "@launchpilot/application";
import {
  BriefAgent,
  ExtractiveBriefDrafter,
  LaunchKitWriter,
  SeoArticleWriter,
  SocialPostWriter,
  TemplateLaunchKitWriter,
  TemplateArticleWriter,
  TemplatePostWriter,
} from "@launchpilot/agents";
import {
  AesGcmTokenCipher,
  DataForSeoKeywordProvider,
  SeedKeywordProvider,
  WordPressConnectionVerifier,
  WordPressPublisherProvider,
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
} from "@launchpilot/adapters";
import { parseWebConfig, type ClaudeConfig, type WebConfig } from "./server/config";
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

const build = (config: WebConfig) => {
  const billing = billingFor(config);
  const repositories = createPostgresRepositories(createDatabase(config.databaseUrl));
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
    blogVerifier: new WordPressConnectionVerifier(network),
    socialWriter: socialWriterFor(config.social),
    launchWriter: launchWriterFor(config.launch),
    linker: new ZernioAccountLinker(zernio),
    // One provider per channel: adding a channel means registering its provider here.
    publishers: new PublisherRegistry([
      new WordPressPublisherProvider(repositories.channelConnections, cipher, {
        ...network,
        clock: container.clock,
      }),
      new ZernioPublisherProvider("x", repositories.socialProfiles, zernio),
      new ZernioPublisherProvider("linkedin", repositories.socialProfiles, zernio),
    ]),
    clock: container.clock,
    ids: new UuidIdGenerator(),
    tokens: new RandomTokenGenerator(),
    hasher: new ScryptPasswordHasher(),
    appUrl: config.appUrl,
  };
  return {
    appUrl: config.appUrl,
    webhookSignatureHeader: billing.webhookSignatureHeader,
    localCheckout: billing.localCheckout,
    signUp: new SignUp(deps),
    logIn: new LogIn(deps),
    logOut: new LogOut(deps),
    authenticate: new AuthenticateSession(deps),
    createProduct: new CreateProduct(deps),
    getDashboard: new GetDashboard(deps),
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
  };
};

export type AppContainer = ReturnType<typeof build>;

// Cached on globalThis so dev-server reloads reuse one connection pool.
const cache = globalThis as { launchpilotApp?: AppContainer };

/** Builds the app on first use, so `next build` never needs runtime secrets. */
export const getAppContainer = (): AppContainer => {
  if (cache.launchpilotApp) return cache.launchpilotApp;
  const config = parseWebConfig(process.env);
  if (!config.ok) throw new Error(`Invalid configuration: ${config.error}`);
  cache.launchpilotApp = build(config.value);
  return cache.launchpilotApp;
};
