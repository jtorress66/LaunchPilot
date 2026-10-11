import { channels } from "@launchpilot/domain";
import {
  describeKeywordProviderContract,
  describeMetricsSourceContract,
  describePublisherContract,
  describeSiteCrawlerContract,
} from "../contracts";
import { FakeKeywordProvider, FakeMetricsSource, FakePublisher, FakeSiteCrawler } from "../src";
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
