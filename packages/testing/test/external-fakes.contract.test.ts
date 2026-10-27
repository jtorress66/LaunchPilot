import { channels } from "@nuvantre/domain";
import {
  describeBlogConnectionVerifierContract,
  describeSocialAccountLinkerContract,
  describeKeywordProviderContract,
  describePublisherProviderContract,
  describeMetricsSourceContract,
  describePublisherContract,
  describeSiteCrawlerContract,
  describeGoogleAuthorizerContract,
  describeAnalyticsPropertyListerContract,
  describePlausibleSiteVerifierContract,
} from "../contracts";
import {
  FakeBlogConnectionVerifier,
  FakeSocialAccountLinker,
  FakeKeywordProvider,
  FakeMetricsSource,
  FakePublisher,
  FakePublisherProvider,
  FakeSiteCrawler,
  FakeGoogleAuthorizer,
  FakeAnalyticsPropertyLister,
  FakePlausibleSiteVerifier,
} from "../src";
import { productId } from "@nuvantre/domain";
import { isAutoPublishable } from "@nuvantre/domain";

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
  const source = new FakeMetricsSource("search_console");
  return {
    source,
    metrics: ["search_clicks", "search_impressions", "search_ctr", "search_position"],
    givenWeek: (values) => {
      source.setValues(values);
    },
    givenNotConnected: () => {
      source.disconnect(productId("prod_1"));
    },
    givenFailure: () => {
      source.failNext(outage);
    },
  };
});

describeGoogleAuthorizerContract("FakeGoogleAuthorizer", () => {
  const authorizer = new FakeGoogleAuthorizer();
  return { authorizer, validCode: authorizer.issueCode() };
});

describeAnalyticsPropertyListerContract("FakeAnalyticsPropertyLister", () => ({
  lister: new FakeAnalyticsPropertyLister(),
  validToken: FakeAnalyticsPropertyLister.validToken,
}));

describePlausibleSiteVerifierContract("FakePlausibleSiteVerifier", () => ({
  verifier: new FakePlausibleSiteVerifier(),
  valid: FakePlausibleSiteVerifier.valid,
}));

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
  const valid = {
    platform: "wordpress" as const,
    siteUrl: "https://blog.acme.dev",
    settings: { username: "admin" },
    secret: "abcd efgh ijkl",
  };
  verifier.accept(valid, "Acme Blog");
  return { verifier, valid };
});

describePublisherProviderContract("FakePublisherProvider", () => {
  const provider = new FakePublisherProvider("blog");
  provider.connect(productId("prod_1"));
  return { provider, connected: productId("prod_1"), unconnected: productId("prod_2") };
});

describeSocialAccountLinkerContract("FakeSocialAccountLinker", () => ({
  linker: new FakeSocialAccountLinker(),
  unknownProfileId: "zp_unknown_profile",
}));
