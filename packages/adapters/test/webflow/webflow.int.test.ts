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
  WebflowConnectionVerifier,
  WebflowPublisher,
  webflowPublisherFactory,
} from "../../src";
import { recordedServer } from "../blog/recorded-server";
import collection from "./recorded/collection.json";
import withoutRichText from "./recorded/collection-without-rich-text.json";
import notAuthorized from "./recorded/error-not-authorized.json";
import notFound from "./recorded/error-not-found.json";
import validation from "./recorded/error-validation.json";
import itemCreated from "./recorded/item-created.json";

const TOKEN = "f3c1d2e4b5a6978877665544332211aa00bbccddeeff00112233445566778899";
const COLLECTION = "6487b1d5c2a3e4f5a6b7c8d9";
const SITE = "https://www.acme.dev/";
const now = new Date("2026-10-27T12:00:00.000Z");
const RESOLVED = {
  collectionId: COLLECTION,
  collectionSlug: "post",
  bodyField: "post-body",
  summaryField: "post-summary",
};

const authorised = (req: IncomingMessage) => req.headers.authorization === `Bearer ${TOKEN}`;

const { state: webflow, json } = recordedServer((routes) => {
  routes.set(`GET /v2/collections/${COLLECTION}`, (req, res) => {
    json(authorised(req) ? 200 : 401, authorised(req) ? collection : notAuthorized)(req, res);
  });
  routes.set(`POST /v2/collections/${COLLECTION}/items/live`, (req, res) => {
    json(authorised(req) ? 202 : 401, authorised(req) ? itemCreated : notAuthorized)(req, res);
  });
});

const network = { allowPrivateNetwork: true, timeoutMs: 2_000 };
const clock = new FixedClock(now);
const api = (options = network) => ({ ...options, apiBaseUrl: webflow.url });
const verifier = (options = network) => new WebflowConnectionVerifier(api(options));
const publisher = (options = network, settings: Record<string, string> = RESOLVED) =>
  new WebflowPublisher({ siteUrl: SITE, token: TOKEN, settings }, { ...api(options), clock });
const credentials = () => ({
  platform: "webflow" as const,
  siteUrl: "https://www.acme.dev",
  settings: { collectionId: COLLECTION },
  secret: TOKEN,
});
const sentItem = () =>
  JSON.parse(webflow.received[0]?.body ?? "{}") as { fieldData: Record<string, string> };
const items = `POST /v2/collections/${COLLECTION}/items/live`;

describeBlogConnectionVerifierContract("WebflowConnectionVerifier (recorded Data API)", () => ({
  verifier: verifier(),
  get valid() {
    return credentials();
  },
}));

describePublisherContract("WebflowPublisher (recorded Data API)", () => ({
  publisher: publisher(),
  givenOutage: () => {
    webflow.routes.set(items, json(503, { message: "Service Unavailable" }));
  },
}));

describePublisherProviderContract("BlogPublisherProvider for Webflow", async () => {
  const cipher = new AesGcmTokenCipher(randomBytes(32).toString("base64"));
  const connections = new InMemoryChannelConnectionRepository();
  await connections.save({
    ...aBlogConnection({ siteUrl: SITE, platform: "webflow", settings: RESOLVED }),
    encryptedSecret: await cipher.encrypt(TOKEN),
  });
  return {
    provider: new BlogPublisherProvider(connections, cipher, {
      webflow: webflowPublisherFactory({ ...api(), clock }),
    }),
    connected: productId("prod_1"),
    unconnected: productId("prod_2"),
  };
});

describe("WebflowConnectionVerifier", () => {
  it("finds the collection's rich-text body and summary fields and keeps them for publishing", async () => {
    expect(await verifier().verify(credentials())).toEqual({
      ok: true,
      value: { siteName: "www.acme.dev", siteUrl: SITE, settings: RESOLVED },
    });
    expect(webflow.received.map((r) => `${r.method} ${r.path}`)).toEqual([
      `GET /v2/collections/${COLLECTION}`,
    ]);
  });

  it("publishes without a summary when the collection has no summary field", async () => {
    const fields = collection.fields.filter((field) => field.slug !== "post-summary");
    webflow.routes.set(`GET /v2/collections/${COLLECTION}`, json(200, { ...collection, fields }));
    const result = await verifier().verify(credentials());
    expect(result.ok && result.value.settings).not.toHaveProperty("summaryField");
  });

  it("refuses a collection without a rich-text field for the article", async () => {
    webflow.routes.set(`GET /v2/collections/${COLLECTION}`, json(200, withoutRichText));
    expect(await verifier().verify(credentials())).toEqual({
      ok: false,
      error: {
        code: "wrong_platform",
        message: "The Team Members collection has no Rich Text field for the article",
        retryable: false,
      },
    });
  });

  it("refuses a collection ID the token cannot see", async () => {
    webflow.routes.set(`GET /v2/collections/${COLLECTION}`, json(404, notFound));
    expect(await verifier().verify(credentials())).toMatchObject({
      ok: false,
      error: {
        code: "invalid_credentials",
        message: "Webflow has no collection with that ID for this token",
      },
    });
  });

  it("refuses a private address when private networking is off", async () => {
    const result = await verifier({ ...network, allowPrivateNetwork: false }).verify(credentials());
    expect(result).toMatchObject({ ok: false, error: { code: "blocked" } });
    expect(webflow.received).toEqual([]);
  });
});

describe("WebflowPublisher", () => {
  it("creates a live item with the article's fields and returns its page on the site", async () => {
    const item = {
      ...aPublishableItem("blog"),
      seo: { slug: "cookieless-analytics", excerpt: "Five numbers a week, no cookies." },
    } as PublishableContentItem;
    expect(await publisher().publish(item)).toEqual({
      ok: true,
      value: { channel: "blog", externalUrl: `${SITE}post/cookieless-analytics`, publishedAt: now },
    });
    expect(webflow.received[0]?.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(webflow.received[0]?.body ?? "{}")).toEqual({
      isArchived: false,
      isDraft: false,
      fieldData: {
        name: item.title,
        slug: "cookieless-analytics",
        "post-body": `<p>${item.body}</p>\n`,
        "post-summary": "Five numbers a week, no cookies.",
      },
    });
  });

  it("makes a slug from the title when the article has none", async () => {
    const item = { ...aPublishableItem("blog"), title: "Five Numbers, No Cookies!" };
    await publisher().publish(item);
    expect(sentItem().fieldData).toMatchObject({ slug: "five-numbers-no-cookies" });
    expect(sentItem().fieldData).not.toHaveProperty("post-summary");
  });

  it("explains Webflow's own reason when it rejects the item", async () => {
    webflow.routes.set(items, json(400, validation));
    expect(await publisher().publish(aPublishableItem("blog"))).toEqual({
      ok: false,
      error: {
        code: "rejected_by_platform",
        message:
          "Webflow rejected the post: slug: Unique value is already in database: 'cookieless-analytics'",
        retryable: false,
      },
    });
  });

  it.each([
    ["a revoked token", "not_connected", 401, notAuthorized, false],
    ["a rate limit", "unavailable", 429, { message: "Too Many Requests" }, true],
  ] as const)("reports %s as %s", async (_case, code, status, payload, retryable) => {
    webflow.routes.set(items, json(status, payload));
    const result = await publisher().publish(aPublishableItem("blog"));
    expect(result).toMatchObject({ ok: false, error: { code, retryable } });
    if (result.ok) return;
    expect(result.error.message).not.toContain(TOKEN);
  });

  it("asks to reconnect when the connection has no body field saved", async () => {
    const stale = publisher(network, { collectionId: COLLECTION });
    expect(await stale.publish(aPublishableItem("blog"))).toMatchObject({
      ok: false,
      error: { code: "not_connected" },
    });
    expect(webflow.received).toEqual([]);
  });

  it("refuses a private address when private networking is off", async () => {
    const result = await publisher({ ...network, allowPrivateNetwork: false }).publish(
      aPublishableItem("blog"),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "not_connected" } });
    expect(webflow.received).toEqual([]);
  });
});
