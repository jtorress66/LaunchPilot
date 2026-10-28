import {
  FakeCampaignPlanner,
  FakeContentReviewer,
  InMemoryAutopilotRunRepository,
  InMemoryAuditTrail,
  FakeErrorReporter,
  FakeAnalyticsPropertyLister,
  FakeGoogleAuthorizer,
  FakeMetricsSource,
  FakePlausibleSiteVerifier,
  FakeWeeklyReportAnalyst,
  InMemoryAnalyticsConnectionRepository,
  InMemoryWeeklyReportRepository,
  FakeBlogConnectionVerifier,
  FakeContentDrafter,
  FakeKeywordProvider,
  FakePublisherProvider,
  FakeSocialAccountLinker,
  FakeLaunchKitDrafter,
  InMemoryDirectoryCatalog,
  InMemoryLaunchKitRepository,
  InMemorySubmissionRepository,
  aDirectory,
  FakeTokenCipher,
  InMemorySocialProfileRepository,
  InMemoryCampaignRepository,
  InMemoryChannelConnectionRepository,
  InMemoryContentItemRepository,
  InMemoryTaskRepository,
  FakeBriefDrafter,
  FakeCheckoutProvider,
  FakeSiteCrawler,
  InMemoryBriefRepository,
  FakePasswordHasher,
  FakeWebhookVerifier,
  FixedClock,
  InMemoryProductRepository,
  InMemorySessionRepository,
  InMemorySubscriptionRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  SequentialIdGenerator,
  SequentialTokenGenerator,
} from "@nuvantre/testing";
import { DrafterRegistry, MetricsSourceRegistry, PublisherRegistry, SignUp } from "../src";

/** Every port a use case may need, backed by in-memory fakes. */
export const makeWorld = () => {
  const clock = new FixedClock(new Date("2026-05-01T09:00:00.000Z"));
  const blogPublisher = new FakePublisherProvider("blog", clock);
  const xPublisher = new FakePublisherProvider("x", clock);
  const linkedinPublisher = new FakePublisherProvider("linkedin", clock);
  const searchConsole = new FakeMetricsSource("search_console");
  const ga4 = new FakeMetricsSource("ga4");
  const plausible = new FakeMetricsSource("plausible");
  const writer = new FakeContentDrafter();
  const socialWriter = new FakeContentDrafter();
  return {
    clock,
    ids: new SequentialIdGenerator(),
    tokens: new SequentialTokenGenerator(),
    hasher: new FakePasswordHasher(),
    users: new InMemoryUserRepository(),
    sessions: new InMemorySessionRepository(),
    workspaces: new InMemoryWorkspaceRepository(),
    subscriptions: new InMemorySubscriptionRepository(),
    products: new InMemoryProductRepository(),
    briefs: new InMemoryBriefRepository(),
    crawler: new FakeSiteCrawler(),
    drafter: new FakeBriefDrafter(),
    checkout: new FakeCheckoutProvider(),
    verifier: new FakeWebhookVerifier(),
    appUrl: "https://app.nuvantre.test",
    campaigns: new InMemoryCampaignRepository(),
    tasks: new InMemoryTaskRepository(),
    contentItems: new InMemoryContentItemRepository(),
    connections: new InMemoryChannelConnectionRepository(),
    cipher: new FakeTokenCipher(),
    blogVerifier: new FakeBlogConnectionVerifier(),
    keywords: new FakeKeywordProvider(),
    writer,
    socialWriter,
    drafters: new DrafterRegistry([
      { channel: "blog", drafter: writer },
      { channel: "x", drafter: socialWriter },
      { channel: "linkedin", drafter: socialWriter },
    ]),
    planner: new FakeCampaignPlanner(),
    reviewer: new FakeContentReviewer(),
    autopilotRuns: new InMemoryAutopilotRunRepository(),
    audit: new InMemoryAuditTrail(),
    errors: new FakeErrorReporter(),
    blogPublisher,
    xPublisher,
    linkedinPublisher,
    publishers: new PublisherRegistry([blogPublisher, xPublisher, linkedinPublisher]),
    socialProfiles: new InMemorySocialProfileRepository(),
    linker: new FakeSocialAccountLinker(),
    launchWriter: new FakeLaunchKitDrafter(),
    launchKits: new InMemoryLaunchKitRepository(),
    submissions: new InMemorySubmissionRepository(),
    googleAuth: new FakeGoogleAuthorizer(),
    propertyLister: new FakeAnalyticsPropertyLister(),
    plausibleVerifier: new FakePlausibleSiteVerifier(),
    analyticsConnections: new InMemoryAnalyticsConnectionRepository(),
    weeklyReports: new InMemoryWeeklyReportRepository(),
    searchConsole,
    ga4,
    plausible,
    metricsSources: new MetricsSourceRegistry([searchConsole, ga4, plausible]),
    analyst: new FakeWeeklyReportAnalyst(),
    directories: new InMemoryDirectoryCatalog([
      aDirectory({
        slug: "product-hunt",
        name: "Product Hunt",
        channel: "producthunt",
        limits: { tagline: 60 },
      }),
      aDirectory({ slug: "betalist", name: "BetaList", limits: { tagline: 20 } }),
      aDirectory({ slug: "g2", name: "G2", kind: "directory", pricing: "paid", limits: {} }),
      aDirectory({
        slug: "show-hn",
        name: "Show HN",
        kind: "community",
        channel: "hackernews",
        limits: {},
      }),
    ]),
  };
};

export type World = ReturnType<typeof makeWorld>;

export const PASSWORD = "correct horse battery";

/** A founder who has just signed up. */
export const signedUp = async (world: World, email = "founder@acme.dev") => {
  const result = await new SignUp(world).execute({ email, password: PASSWORD });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};
