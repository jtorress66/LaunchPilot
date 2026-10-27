import { describeKeywordProviderContract } from "@nuvantre/testing/contracts";
import { SeedKeywordProvider } from "../src";

describeKeywordProviderContract("SeedKeywordProvider", () => ({
  provider: new SeedKeywordProvider(),
  givenIdeas: () => {
    // Offline: ideas always come from the seeds themselves.
  },
  givenFailure: () => ({ seeds: [], locale: { language: "en", market: "US" }, limit: 5 }),
}));
