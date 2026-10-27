import { productId, type PublishableContentItem } from "@nuvantre/domain";
import {
  aBlogConnection,
  aPublishableItem,
  FixedClock,
  InMemoryChannelConnectionRepository,
} from "@nuvantre/testing";
import {
  describeBlogConnectionVerifierContract,
  describePublisherContract,
  describePublisherProviderContract,
} from "@nuvantre/testing/contracts";
import { randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import {
  AesGcmTokenCipher,
  BlogPublisherProvider,
  SHOPIFY_API_VERSION,
  ShopifyConnectionVerifier,
  ShopifyPublisher,
  shopifyPublisherFactory,
} from "../../src";
import { recordedServer, type Route } from "../blog/recorded-server";
import accessDenied from "./recorded/access-denied.json";
import articleCreated from "./recorded/article-created.json";
import articleUserErrors from "./recorded/article-user-errors.json";
import invalidToken from "./recorded/error-invalid-token.json";
import noBlogs from "./recorded/no-blogs.json";
import shopAndBlogs from "./recorded/shop-and-blogs.json";
import throttled from "./recorded/throttled.json";

const TOKEN = "recorded-shopify-access-token";
const now = new Date("2026-10-27T12:00:00.000Z");
const GRAPHQL = `/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
const BLOG = { blogId: "gid://shopify/Blog/84123123", blogHandle: "news" };
const RESOLVED = { ...BLOG, publicUrl: "https://shop.acme.dev/", author: "Acme Store" };

const authorised = (req: IncomingMessage) => req.headers["x-shopify-access-token"] === TOKEN;
const isMutation = (body: string) => body.includes("articleCreate");

const { state: shopify, json } = recordedServer((routes) => {
  routes.set(`POST ${GRAPHQL}`, (req, res) => {
    if (!authorised(req)) {
      json(401, invalidToken)(req, res);
      return;
    }
    json(200, isMutation(req.body) ? articleCreated : shopAndBlogs)(req, res);
  });
});

/** Answers the verify query or the publish mutation with `route`, the other as recorded. */
const answer = (operation: "query" | "mutation", route: Route) => {
  shopify.routes.set(`POST ${GRAPHQL}`, (req, res) => {
    const matches = isMutation(req.body) === (operation === "mutation");
    if (matches) {
      route(req, res);
      return;
    }
    json(200, isMutation(req.body) ? articleCreated : shopAndBlogs)(req, res);
  });
};

const network = { allowPrivateNetwork: true, timeoutMs: 2_000 };
const clock = new FixedClock(now);
const verifier = (options = network) => new ShopifyConnectionVerifier(options);
const publisher = (options = network) =>
  new ShopifyPublisher(
    { storeUrl: shopify.url, accessToken: TOKEN, settings: RESOLVED },
    { ...options, clock },
  );
const credentials = () => ({
  platform: "shopify" as const,
  siteUrl: shopify.url,
  settings: {},
  secret: TOKEN,
});
const sentRequest = (index = 0) =>
  JSON.parse(shopify.received[index]?.body ?? "{}") as {
    query: string;
    variables?: { article?: Record<string, unknown> };
  };

describeBlogConnectionVerifierContract("ShopifyConnectionVerifier (recorded GraphQL)", () => ({
  verifier: verifier(),
  get valid() {
    return credentials();
  },
}));

describePublisherContract("ShopifyPublisher (recorded GraphQL)", () => ({
  publisher: publisher(),
  givenOutage: () => {
    answer("mutation", json(503, { errors: "Service unavailable" }));
  },
}));

describePublisherProviderContract("BlogPublisherProvider for Shopify", async () => {
  const cipher = new AesGcmTokenCipher(randomBytes(32).toString("base64"));
  const connections = new InMemoryChannelConnectionRepository();
  await connections.save({
    ...aBlogConnection({ siteUrl: shopify.url, platform: "shopify", settings: RESOLVED }),
    encryptedSecret: await cipher.encrypt(TOKEN),
  });
  return {
    provider: new BlogPublisherProvider(connections, cipher, {
      shopify: shopifyPublisherFactory({ ...network, clock }),
    }),
    connected: productId("prod_1"),
    unconnected: productId("prod_2"),
  };
});

describe("ShopifyConnectionVerifier", () => {
  it("names the shop and keeps its first blog, public address and name for publishing", async () => {
    expect(await verifier().verify(credentials())).toEqual({
      ok: true,
      value: { siteName: "Acme Store", siteUrl: shopify.url, settings: RESOLVED },
    });
    const [sent] = shopify.received;
    expect(sent).toMatchObject({ method: "POST", path: GRAPHQL });
    expect(sent?.headers["content-type"]).toBe("application/json");
    expect(sentRequest().query).toContain("primaryDomain");
  });

  it("uses the blog the founder named by its handle", async () => {
    const result = await verifier().verify({
      ...credentials(),
      settings: { blogHandle: "guides" },
    });
    expect(result.ok && result.value.settings).toMatchObject({
      blogId: "gid://shopify/Blog/84123124",
      blogHandle: "guides",
    });
  });

  it.each([
    [
      "a store without a blog",
      noBlogs,
      "This store has no blog yet. Add one under Online Store → Blog posts.",
    ],
    [
      "a blog handle the store does not have",
      shopAndBlogs,
      'This store has no blog with the handle "recipes"',
    ],
  ])("refuses %s", async (_case, payload, message) => {
    answer("query", json(200, payload));
    const settings = payload === noBlogs ? {} : { blogHandle: "recipes" };
    expect(await verifier().verify({ ...credentials(), settings })).toEqual({
      ok: false,
      error: { code: "wrong_platform", message, retryable: false },
    });
  });

  it("refuses a token without access to the store's blogs", async () => {
    answer("query", json(200, accessDenied));
    expect(await verifier().verify(credentials())).toMatchObject({
      ok: false,
      error: {
        code: "invalid_credentials",
        message:
          "This access token cannot manage blog posts. Give the app the write_content scope.",
      },
    });
  });

  it("reports an address that is not a Shopify store as wrong_platform", async () => {
    shopify.routes.clear();
    expect(await verifier().verify(credentials())).toMatchObject({
      ok: false,
      error: { code: "wrong_platform", message: "This address is not a Shopify store" },
    });
  });

  it("refuses a private address when private networking is off", async () => {
    const result = await verifier({ ...network, allowPrivateNetwork: false }).verify(credentials());
    expect(result).toMatchObject({ ok: false, error: { code: "blocked" } });
    expect(shopify.received).toEqual([]);
  });
});

describe("ShopifyPublisher", () => {
  it("creates a published article on the saved blog and returns its public address", async () => {
    const item = {
      ...aPublishableItem("blog"),
      seo: { slug: "cookieless-analytics", excerpt: "Five numbers a week, no cookies." },
    } as PublishableContentItem;
    expect(await publisher().publish(item)).toEqual({
      ok: true,
      value: {
        channel: "blog",
        externalUrl: "https://shop.acme.dev/blogs/news/cookieless-analytics",
        publishedAt: now,
      },
    });
    expect(shopify.received[0]?.headers["x-shopify-access-token"]).toBe(TOKEN);
    expect(sentRequest().query).toContain("articleCreate");
    expect(sentRequest().variables).toEqual({
      article: {
        blogId: BLOG.blogId,
        title: item.title,
        body: `<p>${item.body}</p>\n`,
        isPublished: true,
        author: { name: "Acme Store" },
        handle: "cookieless-analytics",
        summary: "Five numbers a week, no cookies.",
      },
    });
  });

  it("leaves the handle and summary to Shopify when the article has none", async () => {
    await publisher().publish(aPublishableItem("blog"));
    expect(sentRequest().variables?.article).not.toHaveProperty("handle");
    expect(sentRequest().variables?.article).not.toHaveProperty("summary");
  });

  it("explains Shopify's own reason when it rejects the article", async () => {
    answer("mutation", json(200, articleUserErrors));
    expect(await publisher().publish(aPublishableItem("blog"))).toEqual({
      ok: false,
      error: {
        code: "rejected_by_platform",
        message: "Shopify rejected the post: Handle has already been taken",
        retryable: false,
      },
    });
  });

  it.each([
    ["a revoked token", "not_connected", json(401, invalidToken), false],
    ["a removed scope", "not_connected", json(200, accessDenied), false],
    ["a throttled request", "unavailable", json(200, throttled), true],
    ["a server error", "unavailable", json(503, { errors: "Service unavailable" }), true],
  ] as const)("reports %s as %s", async (_case, code, route, retryable) => {
    answer("mutation", route);
    const result = await publisher().publish(aPublishableItem("blog"));
    expect(result).toMatchObject({ ok: false, error: { code, retryable } });
    if (result.ok) return;
    expect(result.error.message).not.toContain(TOKEN);
  });

  it("reports a reply without the new article as unavailable", async () => {
    answer("mutation", json(200, { data: { articleCreate: { article: null, userErrors: [] } } }));
    expect(await publisher().publish(aPublishableItem("blog"))).toMatchObject({
      ok: false,
      error: { code: "unavailable", retryable: true },
    });
  });

  it("asks to reconnect when the connection has no blog saved", async () => {
    const stale = new ShopifyPublisher(
      { storeUrl: shopify.url, accessToken: TOKEN, settings: {} },
      { ...network, clock },
    );
    expect(await stale.publish(aPublishableItem("blog"))).toMatchObject({
      ok: false,
      error: { code: "not_connected" },
    });
    expect(shopify.received).toEqual([]);
  });

  it("refuses a private address when private networking is off", async () => {
    const result = await publisher({ ...network, allowPrivateNetwork: false }).publish(
      aPublishableItem("blog"),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "not_connected" } });
    expect(shopify.received).toEqual([]);
  });
});
