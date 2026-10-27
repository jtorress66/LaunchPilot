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
import { createHmac, randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import {
  AesGcmTokenCipher,
  BlogPublisherProvider,
  GhostConnectionVerifier,
  GhostPublisher,
  ghostPublisherFactory,
} from "../../src";
import { recordedServer } from "../blog/recorded-server";
import unauthorized from "./recorded/error-unauthorized.json";
import validation from "./recorded/error-validation.json";
import postCreated from "./recorded/post-created.json";
import postsBrowse from "./recorded/posts-browse.json";
import siteInfo from "./recorded/site.json";

const KEY_ID = "6489f2f3a1b2c3d4e5f60718";
const KEY_SECRET = "5f1c0a9b8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a3928170f6e5d4c";
const ADMIN_KEY = `${KEY_ID}:${KEY_SECRET}`;
const now = new Date("2026-10-27T12:00:00.000Z");
const ADMIN = "/ghost/api/admin";

/** Ghost accepts a token whose signature checks out with the integration's secret. */
const authorised = (req: IncomingMessage) => {
  const [scheme, token = ""] = (req.headers.authorization ?? "").split(" ");
  const [header = "", payload = "", signature = ""] = token.split(".");
  const expected = createHmac("sha256", Buffer.from(KEY_SECRET, "hex"))
    .update(`${header}.${payload}`)
    .digest("base64url");
  return scheme === "Ghost" && signature === expected;
};

const { state: ghost, json } = recordedServer((routes) => {
  routes.set(`GET ${ADMIN}/site/`, json(200, siteInfo));
  routes.set(`GET ${ADMIN}/posts/`, (req, res) => {
    json(authorised(req) ? 200 : 401, authorised(req) ? postsBrowse : unauthorized)(req, res);
  });
  routes.set(`POST ${ADMIN}/posts/`, (req, res) => {
    json(authorised(req) ? 201 : 401, authorised(req) ? postCreated : unauthorized)(req, res);
  });
});

const network = { allowPrivateNetwork: true, timeoutMs: 2_000 };
const clock = new FixedClock(now);
const verifier = (options = network) => new GhostConnectionVerifier({ ...options, clock });
const publisher = (options = network) =>
  new GhostPublisher({ siteUrl: ghost.url, adminKey: ADMIN_KEY }, { ...options, clock });
const credentials = () => ({
  platform: "ghost" as const,
  siteUrl: ghost.url,
  settings: {},
  secret: ADMIN_KEY,
});

describeBlogConnectionVerifierContract("GhostConnectionVerifier (recorded Admin API)", () => ({
  verifier: verifier(),
  get valid() {
    return credentials();
  },
}));

describePublisherContract("GhostPublisher (recorded Admin API)", () => ({
  publisher: publisher(),
  givenOutage: () => {
    ghost.routes.set(`POST ${ADMIN}/posts/`, json(503, { errors: [{ message: "Down" }] }));
  },
}));

describePublisherProviderContract("BlogPublisherProvider for Ghost", async () => {
  const cipher = new AesGcmTokenCipher(randomBytes(32).toString("base64"));
  const connections = new InMemoryChannelConnectionRepository();
  await connections.save({
    ...aBlogConnection({ siteUrl: ghost.url, platform: "ghost", settings: {} }),
    encryptedSecret: await cipher.encrypt(ADMIN_KEY),
  });
  return {
    provider: new BlogPublisherProvider(connections, cipher, {
      ghost: ghostPublisherFactory({ ...network, clock }),
    }),
    connected: productId("prod_1"),
    unconnected: productId("prod_2"),
  };
});

describe("GhostConnectionVerifier", () => {
  it("names the site from Ghost, then checks the key can read posts", async () => {
    expect(
      await verifier().verify({ ...credentials(), siteUrl: ghost.url.replace(/\/$/, "") }),
    ).toEqual({
      ok: true,
      value: { siteName: "Acme Ghost Blog", siteUrl: ghost.url, settings: {} },
    });
    expect(ghost.received.map((r) => `${r.method} ${r.path}`)).toEqual([
      `GET ${ADMIN}/site/`,
      `GET ${ADMIN}/posts/`,
    ]);
    expect(ghost.received[1]?.headers["accept-version"]).toBe("v5.0");
  });

  it("reports an address without Ghost's Admin API as wrong_platform", async () => {
    ghost.routes.delete(`GET ${ADMIN}/site/`);
    expect(await verifier().verify(credentials())).toMatchObject({
      ok: false,
      error: { code: "wrong_platform", message: "This address is not a Ghost site" },
    });
  });

  it("refuses a key that is not in Ghost's id:secret form without calling Ghost with it", async () => {
    const result = await verifier().verify({ ...credentials(), secret: "not-a-key" });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_credentials",
        message: "That is not a Ghost Admin API key. Copy it from Settings → Integrations.",
        retryable: false,
      },
    });
    expect(ghost.received.map((r) => r.path)).toEqual([`${ADMIN}/site/`]);
  });

  it("refuses a well-formed key Ghost does not accept", async () => {
    const other = `${KEY_ID}:${"0".repeat(64)}`;
    expect(await verifier().verify({ ...credentials(), secret: other })).toMatchObject({
      ok: false,
      error: { code: "invalid_credentials", message: "Ghost did not accept that Admin API key" },
    });
  });

  it("refuses a private address when private networking is off", async () => {
    const result = await verifier({ ...network, allowPrivateNetwork: false }).verify(credentials());
    expect(result).toMatchObject({ ok: false, error: { code: "blocked" } });
    expect(ghost.received).toEqual([]);
  });
});

describe("GhostPublisher", () => {
  it("publishes the article as HTML, live, and returns the post's URL", async () => {
    const item = {
      ...aPublishableItem("blog"),
      seo: { slug: "cookieless-analytics", excerpt: "Five numbers a week, no cookies." },
    } as PublishableContentItem;
    expect(await publisher().publish(item)).toEqual({
      ok: true,
      value: {
        channel: "blog",
        externalUrl: `${ghost.url}cookieless-analytics/`,
        publishedAt: now,
      },
    });
    const [sent] = ghost.received;
    expect(sent).toMatchObject({ method: "POST", path: `${ADMIN}/posts/`, search: "?source=html" });
    expect(sent?.headers["content-type"]).toBe("application/json");
    expect(sent?.headers.authorization).toMatch(/^Ghost [\w-]+\.[\w-]+\.[\w-]+$/);
    expect(JSON.parse(sent?.body ?? "{}")).toEqual({
      posts: [
        {
          title: item.title,
          html: `<p>${item.body}</p>\n`,
          status: "published",
          slug: "cookieless-analytics",
          custom_excerpt: "Five numbers a week, no cookies.",
        },
      ],
    });
  });

  it("leaves the slug and excerpt to Ghost when the article has none", async () => {
    await publisher().publish(aPublishableItem("blog"));
    const [post] = (JSON.parse(ghost.received[0]?.body ?? "{}") as { posts: object[] }).posts;
    expect(post).not.toHaveProperty("slug");
    expect(post).not.toHaveProperty("custom_excerpt");
  });

  it.each([
    ["a revoked key", 401, unauthorized, "not_connected", false],
    ["an invalid post", 422, validation, "rejected_by_platform", false],
    ["a server error", 503, { errors: [{ message: "Down" }] }, "unavailable", true],
  ] as const)("reports %s (HTTP %i) as %s", async (_case, status, payload, code, retryable) => {
    ghost.routes.set(`POST ${ADMIN}/posts/`, json(status, payload));
    const result = await publisher().publish(aPublishableItem("blog"));
    expect(result).toMatchObject({ ok: false, error: { code, retryable } });
    if (result.ok) return;
    expect(result.error.message).not.toContain(KEY_SECRET);
  });

  it("explains Ghost's own reason when it rejects a post", async () => {
    ghost.routes.set(`POST ${ADMIN}/posts/`, json(422, validation));
    const result = await publisher().publish(aPublishableItem("blog"));
    expect(result.ok ? undefined : result.error.message).toBe(
      "Ghost rejected the post: Value in [posts.title] exceeds maximum length of 255 characters.",
    );
  });

  it("asks to reconnect when the saved key is malformed", async () => {
    const broken = new GhostPublisher(
      { siteUrl: ghost.url, adminKey: "garbage" },
      { ...network, clock },
    );
    expect(await broken.publish(aPublishableItem("blog"))).toMatchObject({
      ok: false,
      error: { code: "not_connected" },
    });
    expect(ghost.received).toEqual([]);
  });

  it("reports a reply without a valid post URL as unavailable", async () => {
    ghost.routes.set(`POST ${ADMIN}/posts/`, json(201, { posts: [{ url: "nope" }] }));
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
    expect(ghost.received).toEqual([]);
  });
});
