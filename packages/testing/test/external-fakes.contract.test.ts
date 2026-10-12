import { channels } from "@launchpilot/domain";
import {
  describeBlogConnectionVerifierContract,
  describeKeywordProviderContract,
  describePublisherProviderContract,
  describeMetricsSourceContract,
  describePublisherContract,
  describeSiteCrawlerContract,
} from "../contracts";
import {
  FakeBlogConnectionVerifier,
  FakeKeywordProvider,
  FakeMetricsSource,
  FakePublisher,
  FakePublisherProvider,
  FakeSiteCrawler,
} from "../src";
import { productId } from "@launchpilot/domain";
import { isAutoPublishable } from "@launchpilot/domain";

const outage = { code: "unavailable", message: "Simulated outage", retryable: true } as const;

describeSiteCrawlerContract("FakeSiteCrawler", () => {
  const crawler = new FakeSiteCrawler();
  return {
    crawler,
    givenSite: (url, pages) => {
      crawler.addSite(url, pages);
    },
    givenUnreachable: (url) => {
      crawler.makeUnreachable(url);
    },
  };
});

describeKeywordProviderContract("FakeKeywordProvider", () => {
  const provider = new FakeKeywordProvider();
  return {
    provider,
    givenIdeas: (ideas) => {
      provider.setIdeas(ideas);
    },
    givenFailure: () => {
      provider.failNext(outage);
      return undefined;
    },
  };
});

describeMetricsSourceContract("FakeMetricsSource", () => {
  const source = new FakeMetricsSource();
  return {
    source,
    givenValues: (values) => {
      source.setValues(values);
    },
    givenFailure: () => {
      source.failNext(outage);
    },
  };
});

for (const channel of channels.filter(isAutoPublishable)) {
  describePublisherContract(`FakePublisher (${channel})`, () => {
    const publisher = new FakePublisher(channel);
    return {
      publisher,
      givenOutage: () => {
        publisher.failNext(outage);
      },
    };
  });
}

describeBlogConnectionVerifierContract("FakeBlogConnectionVerifier", () => {
  const verifier = new FakeBlogConnectionVerifier();
  const valid = { siteUrl: "https://blog.acme.dev", username: "admin", secret: "abcd efgh ijkl" };
  verifier.accept(valid, "Acme Blog");
  return { verifier, valid };
});

describePublisherProviderContract("FakePublisherProvider", () => {
  const provider = new FakePublisherProvider("blog");
  provider.connect(productId("prod_1"));
  return { provider, connected: productId("prod_1"), unconnected: productId("prod_2") };
});
