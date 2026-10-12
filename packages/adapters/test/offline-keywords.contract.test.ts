import { describeKeywordProviderContract } from "@launchpilot/testing/contracts";
import { SeedKeywordProvider } from "../src";

describeKeywordProviderContract("SeedKeywordProvider", () => ({
  provider: new SeedKeywordProvider(),
  givenIdeas: () => {
    // Offline: ideas always come from the seeds themselves.
  },
  givenFailure: () => ({ seeds: [], locale: "en-US", limit: 5 }),
}));
