import {
  FakeBlogConnectionVerifier,
  FakeContentDrafter,
  FakeKeywordProvider,
  FakePublisherProvider,
  FakeTokenCipher,
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
} from "@launchpilot/testing";
import { PublisherRegistry, SignUp } from "../src";

/** Every port a use case may need, backed by in-memory fakes. */
export const makeWorld = () => {
  const clock = new FixedClock(new Date("2026-05-01T09:00:00.000Z"));
  const blogPublisher = new FakePublisherProvider("blog", clock);
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
    appUrl: "https://app.launchpilot.test",
    campaigns: new InMemoryCampaignRepository(),
    tasks: new InMemoryTaskRepository(),
    contentItems: new InMemoryContentItemRepository(),
    connections: new InMemoryChannelConnectionRepository(),
    cipher: new FakeTokenCipher(),
    blogVerifier: new FakeBlogConnectionVerifier(),
    keywords: new FakeKeywordProvider(),
    writer: new FakeContentDrafter(),
    blogPublisher,
    publishers: new PublisherRegistry([blogPublisher]),
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
