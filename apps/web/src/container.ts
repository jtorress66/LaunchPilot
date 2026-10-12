import {
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
import { BriefAgent, ExtractiveBriefDrafter } from "@launchpilot/agents";
import {
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
} from "@launchpilot/adapters";
import { parseWebConfig, type WebConfig } from "./server/config";
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

/** Claude drafts briefs in production; the offline drafter is allowed only in development and test. */
const briefDrafterFor = ({ drafter }: WebConfig["brief"]) =>
  drafter.kind === "claude"
    ? new BriefAgent(new ClaudeLlmClient({ apiKey: drafter.apiKey, model: drafter.model }))
    : new ExtractiveBriefDrafter();

const build = (config: WebConfig) => {
  const billing = billingFor(config);
  const deps = {
    ...createPostgresRepositories(createDatabase(config.databaseUrl)),
    ...billing,
    crawler: new HttpSiteCrawler({ allowPrivateNetwork: config.brief.allowPrivateNetwork }),
    drafter: briefDrafterFor(config.brief),
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
