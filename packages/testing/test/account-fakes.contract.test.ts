import {
  describeBillingWebhookVerifierContract,
  describeCheckoutProviderContract,
  describePasswordHasherContract,
  describeSessionRepositoryContract,
  describeSubscriptionRepositoryContract,
  describeTokenGeneratorContract,
  describeUserRepositoryContract,
} from "../contracts";
import {
  FakeCheckoutProvider,
  FakePasswordHasher,
  FakeWebhookVerifier,
  InMemorySessionRepository,
  InMemorySubscriptionRepository,
  InMemoryUserRepository,
  SequentialTokenGenerator,
} from "../src";

describePasswordHasherContract("FakePasswordHasher", () => new FakePasswordHasher());
describeTokenGeneratorContract("SequentialTokenGenerator", () => new SequentialTokenGenerator(), {
  minLength: 32,
});
describeUserRepositoryContract("InMemoryUserRepository", () => new InMemoryUserRepository());
describeSessionRepositoryContract(
  "InMemorySessionRepository",
  () => new InMemorySessionRepository(),
);
describeSubscriptionRepositoryContract(
  "InMemorySubscriptionRepository",
  () => new InMemorySubscriptionRepository(),
);
describeCheckoutProviderContract("FakeCheckoutProvider", () => {
  const provider = new FakeCheckoutProvider();
  return {
    provider,
    givenFailure: () => {
      provider.failNext({ code: "provider_error", message: "Simulated outage", retryable: true });
    },
  };
});
describeBillingWebhookVerifierContract("FakeWebhookVerifier", () => ({
  verifier: new FakeWebhookVerifier(),
  sign: (event) => FakeWebhookVerifier.sign(event),
  signIgnored: () => FakeWebhookVerifier.signIgnored(),
}));
