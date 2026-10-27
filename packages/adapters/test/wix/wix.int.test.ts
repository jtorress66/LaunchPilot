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
  WixConnectionVerifier,
  WixPublisher,
  wixPublisherFactory,
} from "../../src";
import { recordedServer } from "../blog/recorded-server";
import categories from "./recorded/categories.json";
import published from "./recorded/draft-post-published.json";
import siteNotFound from "./recorded/error-site-not-found.json";
import unauthorized from "./recorded/error-unauthorized.json";
import validation from "./recorded/error-validation.json";

const API_KEY = "IST.eyJraWQiOiJQb3pIX2FDMiIsImFsZyI6IlJTMjU2In0.wix-api-key-recorded";
const SITE_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const SITE = "https://www.acme.dev/";
const now = new Date("2026-10-27T12:00:00.000Z");
const DRAFTS = "POST /blog/v3/draft-posts";

const authorised = (req: IncomingMessage) => req.headers.authorization === API_KEY;
const onSite = (req: IncomingMessage) => req.headers["wix-site-id"] === SITE_ID;

const { state: wix, json } = recordedServer((routes) => {
  routes.set("GET /blog/v3/categories", (req, res) => {
    if (!authorised(req)) {
      json(401, unauthorized)(req, res);
      return;
    }
    json(onSite(req) ? 200 : 404, onSite(req) ? categories : siteNotFound)(req, res);
  });
  routes.set(DRAFTS, (req, res) => {
    json(authorised(req) ? 200 : 401, authorised(req) ? published : unauthorized)(req, res);
  });
});

const network = { allowPrivateNetwork: true, timeoutMs: 2_000 };
const clock = new FixedClock(now);
const api = (options = network) => ({ ...options, apiBaseUrl: wix.url });
const verifier = (options = network) => new WixConnectionVerifier(api(options));
const publisher = (options = network) =>
  new WixPublisher(
    { siteUrl: SITE, apiKey: API_KEY, settings: { siteId: SITE_ID } },
    { ...api(options), clock },
  );
const credentials = () => ({
  platform: "wix" as const,
  siteUrl: "https://www.acme.dev",
  settings: { siteId: SITE_ID },
  secret: API_KEY,
});
const sent = () =>
  JSON.parse(wix.received[0]?.body ?? "{}") as {
    draftPost: Record<string, unknown>;
    publish: boolean;
    fieldsets: string[];
  };

describeBlogConnectionVerifierContract("WixConnectionVerifier (recorded Blog API)", () => ({
  verifier: verifier(),
  get valid() {
    return credentials();
  },
}));

describePublisherContract("WixPublisher (recorded Blog API)", () => ({
  publisher: publisher(),
  givenOutage: () => {
    wix.routes.set(DRAFTS, json(503, { message: "Service Unavailable", details: {} }));
  },
}));

describePublisherProviderContract("BlogPublisherProvider for Wix", async () => {
  const cipher = new AesGcmTokenCipher(randomBytes(32).toString("base64"));
  const connections = new InMemoryChannelConnectionRepository();
  await connections.save({
    ...aBlogConnection({ siteUrl: SITE, platform: "wix", settings: { siteId: SITE_ID } }),
    encryptedSecret: await cipher.encrypt(API_KEY),
  });
  return {
    provider: new BlogPublisherProvider(connections, cipher, {
      wix: wixPublisherFactory({ ...api(), clock }),
    }),
    connected: productId("prod_1"),
    unconnected: productId("prod_2"),
  };
});

describe("WixConnectionVerifier", () => {
  it("checks the key can read the site's blog", async () => {
    expect(await verifier().verify(credentials())).toEqual({
      ok: true,
      value: { siteName: "www.acme.dev", siteUrl: SITE, settings: { siteId: SITE_ID } },
    });
    const [request] = wix.received;
    expect(request).toMatchObject({ method: "GET", path: "/blog/v3/categories" });
    expect(request?.headers["wix-site-id"]).toBe(SITE_ID);
  });

  it("refuses a site ID the key has no blog for", async () => {
    const result = await verifier().verify({ ...credentials(), settings: { siteId: "other" } });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_credentials",
        message: "Wix has no blog on a site with that ID for this key",
        retryable: false,
      },
    });
  });

  it("refuses a private address when private networking is off", async () => {
    const result = await verifier({ ...network, allowPrivateNetwork: false }).verify(credentials());
    expect(result).toMatchObject({ ok: false, error: { code: "blocked" } });
    expect(wix.received).toEqual([]);
  });
});

describe("WixPublisher", () => {
  it("publishes a draft post in Ricos with its slug and excerpt, and returns its URL", async () => {
    const item = {
      ...aPublishableItem("blog"),
      body: "## Why\n\nFive **numbers**.",
      seo: { slug: "cookieless-analytics", excerpt: "Five numbers a week, no cookies." },
    } as PublishableContentItem;
    expect(await publisher().publish(item)).toEqual({
      ok: true,
      value: {
        channel: "blog",
        externalUrl: "https://www.acme.dev/post/cookieless-analytics",
        publishedAt: now,
      },
    });
    expect(wix.received[0]?.headers).toMatchObject({
      authorization: API_KEY,
      "wix-site-id": SITE_ID,
      "content-type": "application/json",
    });
    expect(sent()).toMatchObject({
      publish: true,
      fieldsets: ["URL"],
      draftPost: {
        title: item.title,
        seoSlug: "cookieless-analytics",
        excerpt: "Five numbers a week, no cookies.",
        richContent: {
          nodes: [
            { type: "HEADING", headingData: { level: 2 } },
            {
              type: "PARAGRAPH",
              nodes: [
                { textData: { text: "Five " } },
                { textData: { text: "numbers" } },
                { textData: { text: "." } },
              ],
            },
          ],
        },
      },
    });
  });

  it("falls back to the site's post address when Wix returns no URL", async () => {
    wix.routes.set(DRAFTS, json(200, { draftPost: { id: "p1", seoSlug: "five-numbers" } }));
    const result = await publisher().publish(aPublishableItem("blog"));
    expect(result.ok && result.value.externalUrl).toBe(`${SITE}post/five-numbers`);
  });

  it("explains Wix's own reason when it rejects the post", async () => {
    wix.routes.set(DRAFTS, json(400, validation));
    expect(await publisher().publish(aPublishableItem("blog"))).toEqual({
      ok: false,
      error: {
        code: "rejected_by_platform",
        message: "Wix rejected the post: draftPost.title must not be empty",
        retryable: false,
      },
    });
  });

  it.each([
    ["a revoked key", "not_connected", 401, unauthorized, false],
    ["a rate limit", "unavailable", 429, { message: "Too many requests", details: {} }, true],
  ] as const)("reports %s as %s", async (_case, code, status, payload, retryable) => {
    wix.routes.set(DRAFTS, json(status, payload));
    const result = await publisher().publish(aPublishableItem("blog"));
    expect(result).toMatchObject({ ok: false, error: { code, retryable } });
    if (result.ok) return;
    expect(result.error.message).not.toContain(API_KEY);
  });

  it("reports a reply without the post as unavailable", async () => {
    wix.routes.set(DRAFTS, json(200, { draftPost: { id: "p1" } }));
    expect(await publisher().publish(aPublishableItem("blog"))).toMatchObject({
      ok: false,
      error: { code: "unavailable", retryable: true },
    });
  });

  it("refuses a private address when private networking is off", async () => {
    const result = await publisher({ ...network, allowPrivateNetwork: false }).publish(
      aPublishableItem("blog"),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "not_connected" } });
    expect(wix.received).toEqual([]);
  });
});
