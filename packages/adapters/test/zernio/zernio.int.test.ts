// Responses below are shaped after Zernio's API as typed by its official SDK (@zernio/node).
import { productId, withLinkedAccounts } from "@launchpilot/domain";
import {
  aPublishableItem,
  aSocialProfile,
  FixedClock,
  InMemorySocialProfileRepository,
} from "@launchpilot/testing";
import {
  describePublisherContract,
  describePublisherProviderContract,
  describeSocialAccountLinkerContract,
} from "@launchpilot/testing/contracts";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  runZernioSmoke,
  ZernioAccountLinker,
  ZernioPublisher,
  ZernioPublisherProvider,
  type ZernioOptions,
} from "../../src";
import accountDisconnected from "./recorded/account-disconnected.json";
import accounts from "./recorded/accounts.json";
import connectUrl from "./recorded/connect-url.json";
import idempotencyConflict from "./recorded/idempotency-conflict.json";
import paymentRequired from "./recorded/payment-required.json";
import postDuplicate from "./recorded/post-duplicate.json";
import postFailed from "./recorded/post-failed.json";
import postPublished from "./recorded/post-published.json";
import profileCreated from "./recorded/profile-created.json";
import profileExists from "./recorded/profile-exists.json";
import profileNotFound from "./recorded/profile-not-found.json";
import rateLimited from "./recorded/rate-limited.json";
import unauthorized from "./recorded/unauthorized.json";

const BASE = "https://zernio.com/api";
const API_KEY = "sk_recorded_zernio_api_key";
const PROFILE_ID = profileCreated.profile._id;
const X_ACCOUNT = "6720f2aa11b2c3d4e5f60001";
const now = new Date("2026-10-12T12:00:00.000Z");
const options: ZernioOptions = { apiKey: API_KEY, clock: new FixedClock(now) };
const POST_URL = postPublished.post.platforms[0]?.platformPostUrl;

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

interface Captured {
  body?: unknown;
  headers?: Headers;
  url?: URL;
}

const respond = (method: "get" | "post", path: string, body: JsonBodyType, status = 200) => {
  const captured: Captured = {};
  server.use(
    http[method](`${BASE}/v1/${path}`, async ({ request }) => {
      captured.headers = request.headers;
      captured.url = new URL(request.url);
      captured.body = method === "get" ? undefined : await request.json();
      return HttpResponse.json(body, { status });
    }),
  );
  return captured;
};

/** Zernio as recorded: one profile per external id, with X and LinkedIn linked. */
const recordedZernio = () => {
  const profiles = new Set<string>();
  server.use(
    http.post(`${BASE}/v1/profiles`, async ({ request }) => {
      const { externalId } = (await request.json()) as { externalId: string };
      if (profiles.has(externalId)) return HttpResponse.json(profileExists, { status: 409 });
      profiles.add(externalId);
      return HttpResponse.json(profileCreated, { status: 201 });
    }),
    http.get(`${BASE}/v1/connect/:platform`, () => HttpResponse.json(connectUrl)),
    http.get(`${BASE}/v1/accounts`, ({ request }) =>
      new URL(request.url).searchParams.get("profileId") === PROFILE_ID
        ? HttpResponse.json(accounts)
        : HttpResponse.json(profileNotFound, { status: 404 }),
    ),
    http.post(`${BASE}/v1/posts`, () => HttpResponse.json(postPublished, { status: 201 })),
  );
};

const linker = () => new ZernioAccountLinker(options);
const publisher = (channel: "x" | "linkedin" = "x") =>
  new ZernioPublisher(channel, X_ACCOUNT, options);

describeSocialAccountLinkerContract("ZernioAccountLinker (recorded API)", () => {
  recordedZernio();
  return { linker: linker(), unknownProfileId: "6720f1c2a9b8c7d6e5f4ffff" };
});

describePublisherContract("ZernioPublisher (recorded API)", () => {
  recordedZernio();
  return {
    publisher: publisher(),
    givenOutage: () => {
      respond("post", "posts", { error: "Internal error", type: "api_error" }, 503);
    },
  };
});

describePublisherProviderContract("ZernioPublisherProvider", async () => {
  const profiles = new InMemorySocialProfileRepository();
  await profiles.save(
    withLinkedAccounts(aSocialProfile(), [{ channel: "x", accountId: X_ACCOUNT }]),
  );
  return {
    provider: new ZernioPublisherProvider("x", profiles, options),
    connected: productId("prod_1"),
    unconnected: productId("prod_2"),
  };
});

describe("ZernioAccountLinker", () => {
  it("creates a profile named after the product, keyed by its id, with the API key", async () => {
    const captured = respond("post", "profiles", profileCreated, 201);
    expect(await linker().createProfile("Acme Analytics", "prod_1")).toEqual({
      ok: true,
      value: { profileId: PROFILE_ID },
    });
    expect(captured.headers?.get("authorization")).toBe(`Bearer ${API_KEY}`);
    expect(captured.body).toEqual({ name: "Acme Analytics", externalId: "prod_1" });
  });

  it("returns the existing profile when the product already has one", async () => {
    respond("post", "profiles", profileExists, 409);
    expect(await linker().createProfile("Acme Analytics", "prod_1")).toEqual({
      ok: true,
      value: { profileId: profileExists.details.existingProfileId },
    });
  });

  it("asks for the channel's linking page, returning the founder to LaunchPilot", async () => {
    const captured = respond("get", "connect/linkedin", connectUrl);
    const result = await linker().linkingUrl(PROFILE_ID, "linkedin", "https://app.test/back?x=1");
    expect(result).toEqual({ ok: true, value: connectUrl.authUrl });
    expect(captured.url?.searchParams.get("profileId")).toBe(PROFILE_ID);
    expect(captured.url?.searchParams.get("redirect_url")).toBe("https://app.test/back?x=1");
  });

  it("uses Zernio's name for X when linking", async () => {
    const captured = respond("get", "connect/twitter", connectUrl);
    expect((await linker().linkingUrl(PROFILE_ID, "x", "https://app.test/back")).ok).toBe(true);
    expect(captured.url?.pathname).toBe("/api/v1/connect/twitter");
  });

  it("lists active X and LinkedIn accounts, ignoring other networks and ones needing reconnection", async () => {
    const captured = respond("get", "accounts", accounts);
    expect(await linker().linkedAccounts(PROFILE_ID)).toEqual({
      ok: true,
      value: [
        { channel: "x", accountId: X_ACCOUNT },
        { channel: "linkedin", accountId: "6720f2aa11b2c3d4e5f60002" },
      ],
    });
    expect(captured.url?.searchParams.get("profileId")).toBe(PROFILE_ID);
  });

  it.each([
    ["a rejected API key", unauthorized, 401, "rejected", false],
    ["an unknown profile", profileNotFound, 404, "rejected", false],
    ["rate limiting", rateLimited, 429, "unavailable", true],
    ["an outage", { error: "Down" }, 502, "unavailable", true],
  ] as const)("reports %s as %s without the key", async (_c, body, status, code, retryable) => {
    respond("get", "accounts", body, status);
    const result = await linker().linkedAccounts(PROFILE_ID);
    expect(result).toMatchObject({ ok: false, error: { code, retryable } });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it("reports an answer it cannot read, or no answer, as unavailable", async () => {
    server.use(http.post(`${BASE}/v1/profiles`, () => new HttpResponse("<html>oops</html>")));
    expect(await linker().createProfile("Acme", "prod_1")).toMatchObject({
      ok: false,
      error: { code: "unavailable", retryable: true },
    });
    server.use(http.get(`${BASE}/v1/accounts`, () => HttpResponse.error()));
    expect(await linker().linkedAccounts(PROFILE_ID)).toMatchObject({
      ok: false,
      error: { code: "unavailable", retryable: true },
    });
  });
});

describe("ZernioPublisher", () => {
  it("publishes the text now to the linked X account, with a key that makes retries safe", async () => {
    const captured = respond("post", "posts", postPublished, 201);
    const item = aPublishableItem("x");
    expect(await publisher().publish(item)).toEqual({
      ok: true,
      value: { channel: "x", externalUrl: POST_URL, publishedAt: now },
    });
    expect(captured.body).toEqual({
      content: item.body,
      platforms: [{ platform: "twitter", accountId: X_ACCOUNT }],
      publishNow: true,
    });
    expect(captured.headers?.get("authorization")).toBe(`Bearer ${API_KEY}`);
    expect(captured.headers?.get("idempotency-key")).toBe(`${item.id}:v${String(item.version)}`);
  });

  it("publishes to LinkedIn under Zernio's platform name", async () => {
    const captured = respond("post", "posts", {
      post: {
        _id: "p2",
        status: "published",
        platforms: [
          {
            platform: "linkedin",
            status: "published",
            platformPostUrl: "https://www.linkedin.com/feed/update/urn:li:share:7251",
          },
        ],
      },
    });
    const result = await new ZernioPublisher("linkedin", "acc_li", options).publish(
      aPublishableItem("linkedin"),
    );
    expect(result.ok && result.value.externalUrl).toBe(
      "https://www.linkedin.com/feed/update/urn:li:share:7251",
    );
    expect(captured.body).toMatchObject({
      platforms: [{ platform: "linkedin", accountId: "acc_li" }],
    });
  });

  it("falls back to the platform's home page when Zernio returns no post URL", async () => {
    respond("post", "posts", { post: { _id: "p3", status: "published", platforms: [] } }, 201);
    const result = await publisher().publish(aPublishableItem("x"));
    expect(result.ok && result.value.externalUrl).toBe("https://x.com/");
  });

  it.each([
    ["a failed publish", postFailed, 207, "rejected_by_platform", false, "too long"],
    ["duplicate content", postDuplicate, 409, "rejected_by_platform", false, "already posted"],
    ["a retry still in flight", idempotencyConflict, 409, "unavailable", true, "Zernio"],
    ["a missing payment method for X", paymentRequired, 402, "not_connected", false, "payment"],
    ["a disconnected account", accountDisconnected, 403, "not_connected", false, "reconnect"],
    ["a rejected API key", unauthorized, 401, "not_connected", false, "API key"],
    ["rate limiting", rateLimited, 429, "unavailable", true, "Zernio"],
    ["an outage", { error: "Down" }, 502, "unavailable", true, "Zernio"],
  ] as const)(
    "reports %s as %s without the key",
    async (_case, body, status, code, retryable, mentions) => {
      respond("post", "posts", body, status);
      const result = await publisher().publish(aPublishableItem("x"));
      expect(result).toMatchObject({ ok: false, error: { code, retryable } });
      if (result.ok) return;
      expect(result.error.message).toContain(mentions);
      expect(result.error.message).not.toContain(API_KEY);
    },
  );

  it("reports an unreachable API or an unreadable answer as unavailable", async () => {
    server.use(http.post(`${BASE}/v1/posts`, () => HttpResponse.error()));
    expect(await publisher().publish(aPublishableItem("x"))).toMatchObject({
      ok: false,
      error: { code: "unavailable", retryable: true },
    });
    respond("post", "posts", { post: "not an object" }, 201);
    expect(await publisher().publish(aPublishableItem("x"))).toMatchObject({
      ok: false,
      error: { code: "unavailable", retryable: true },
    });
  });

  it("can point at another base URL", async () => {
    server.use(
      http.post("http://127.0.0.1:4020/api/v1/posts", () =>
        HttpResponse.json(postPublished, { status: 201 }),
      ),
    );
    const local = new ZernioPublisher("x", X_ACCOUNT, {
      ...options,
      baseUrl: "http://127.0.0.1:4020/api",
    });
    expect((await local.publish(aPublishableItem("x"))).ok).toBe(true);
  });
});

describe("ZernioPublisherProvider", () => {
  it("refuses a product whose profile has not linked the provider's channel", async () => {
    const profiles = new InMemorySocialProfileRepository();
    await profiles.save(
      withLinkedAccounts(aSocialProfile(), [{ channel: "linkedin", accountId: "a" }]),
    );
    const provider = new ZernioPublisherProvider("x", profiles, options);
    expect(await provider.forProduct(productId("prod_1"))).toMatchObject({
      ok: false,
      error: { code: "not_connected", message: "Link your X account first", retryable: false },
    });
  });
});

describe("runZernioSmoke", () => {
  it("posts the text to the test X account, then takes it down again", async () => {
    const posted = respond("post", "posts", postPublished, 201);
    const unpublished = respond("post", `posts/${postPublished.post._id}/unpublish`, {
      message: "Post unpublished",
    });
    const result = await runZernioSmoke(options, X_ACCOUNT, "LaunchPilot CI smoke test 42");
    expect(result).toEqual({ ok: true, value: { postUrl: POST_URL } });
    expect(posted.body).toEqual({
      content: "LaunchPilot CI smoke test 42",
      platforms: [{ platform: "twitter", accountId: X_ACCOUNT }],
      publishNow: true,
    });
    expect(unpublished.body).toEqual({ platform: "twitter" });
  });

  it("explains a failed post without the key", async () => {
    respond("post", "posts", unauthorized, 401);
    const result = await runZernioSmoke(options, X_ACCOUNT, "smoke");
    expect(result).toEqual({ ok: false, error: "Posting failed: Invalid API key." });
  });

  it("reports a post it could not take down", async () => {
    respond("post", "posts", postPublished, 201);
    respond("post", `posts/${postPublished.post._id}/unpublish`, { error: "Not allowed" }, 400);
    expect(await runZernioSmoke(options, X_ACCOUNT, "smoke")).toEqual({
      ok: false,
      error: `Posted ${String(POST_URL)} but could not take it down: Not allowed`,
    });
  });
});
