import {
  describeBillingWebhookVerifierContract,
  describeCheckoutProviderContract,
} from "@nuvantre/testing/contracts";
import { LocalCheckoutProvider, LocalWebhookVerifier, signLocalWebhook } from "../src";

const secret = "local-test-secret-0123456789";

// The local provider has no network to fail, so its harness offers no failure.
describeCheckoutProviderContract("LocalCheckoutProvider", () => ({
  provider: new LocalCheckoutProvider("http://localhost:3000"),
}));

describeBillingWebhookVerifierContract("LocalWebhookVerifier", () => ({
  verifier: new LocalWebhookVerifier(secret),
  sign: (event) => signLocalWebhook(secret, event),
  signIgnored: () => signLocalWebhook(secret, { type: "local.ignored" }),
}));
