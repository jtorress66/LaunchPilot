// Responses below are shaped after Ayrshare's documented API and SDK (social-media-api 1.3.0).
import { productId, withLinkedChannels } from "@launchpilot/domain";
import {
  aPublishableItem,
  aSocialProfile,
  FakeTokenCipher,
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
  AyrshareAccountLinker,
  AyrsharePublisher,
  AyrsharePublisherProvider,
  type AyrshareOptions,
} from "../../src";
import apiKeyInvalid from "./recorded/api-key-invalid.json";
import jwtCreated from "./recorded/jwt-created.json";
import postCreated from "./recorded/post-created.json";
import postDuplicate from "./recorded/post-duplicate.json";
import postNotLinked from "./recorded/post-not-linked.json";
import profileCreated from "./recorded/profile-created.json";
import profileKeyNotFound from "./recorded/profile-key-not-found.json";
import rateLimited from "./recorded/rate-limited.json";
import user from "./recorded/user.json";
import xCredentialsRequired from "./recorded/x-credentials-required.json";

const BASE = "https://api.ayrshare.com";
const API_KEY = "ayr-recorded-api-key";
const PROFILE_KEY = profileCreated.profileKey;
const PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----\nrecorded\n-----END RSA PRIVATE KEY-----";
const X_KEY = "x-consumer-key";
const X_SECRET = "x-consumer-secret";
const now = new Date("2026-10-12T12:00:00.000Z");

const options: AyrshareOptions = {
  apiKey: API_KEY,
  domain: "launchpilot",
  privateKey: PRIVATE_KEY,
  xCredentials: { apiKey: X_KEY, apiSecret: X_SECRET },
  clock: new FixedClock(now),
};

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
}

type Method = "get" | "post" | "delete";

const respond = (method: Method, path: string, body: JsonBodyType, status = 200) => {
  const captured: Captured = {};
  server.use(
    http[method](`${BASE}/api/${path}`, async ({ request }) => {
      captured.headers = request.headers;
      captured.body = method === "get" ? undefined : await request.json();
      return HttpResponse.json(body, { status });
    }),
  );
  return captured;
};

/** Ayrshare as the recordings describe it: one known profile, linked to X and LinkedIn. */
const recordedAyrshare = () => {
  server.use(
    http.post(`${BASE}/api/profiles/profile`, () => HttpResponse.json(profileCreated)),
    http.post(`${BASE}/api/profiles/generateJWT`, () => HttpResponse.json(jwtCreated)),
    http.get(`${BASE}/api/user`, ({ request }) =>
      request.headers.get("profile-key") === PROFILE_KEY
        ? HttpResponse.json(user)
        : HttpResponse.json(profileKeyNotFound, { status: 403 }),
    ),
    http.post(`${BASE}/api/post`, () => HttpResponse.json(postCreated)),
  );
};

const linker = () => new AyrshareAccountLinker(options);
const publisher = (channel: "x" | "linkedin" = "x") =>
  new AyrsharePublisher(channel, PROFILE_KEY, options);

describeSocialAccountLinkerContract("AyrshareAccountLinker (recorded API)", () => {
  recordedAyrshare();
  return { linker: linker(), unknownProfileKey: "UNKNOWN-PROFILE-KEY-123" };
});

describePublisherContract("AyrsharePublisher (recorded API)", () => {
  recordedAyrshare();
  return {
    publisher: publisher(),
    givenOutage: () => {
      respond("post", "post", { status: "error", message: "Internal error" }, 503);
    },
  };
});

describePublisherProviderContract("AyrsharePublisherProvider", async () => {
  const profiles = new InMemorySocialProfileRepository();
  const cipher = new FakeTokenCipher();
  await profiles.save({
    ...withLinkedChannels(aSocialProfile(), ["x"]),
    encryptedProfileKey: await cipher.encrypt(PROFILE_KEY),
  });
  return {
    provider: new AyrsharePublisherProvider("x", profiles, cipher, options),
    connected: productId("prod_1"),
    unconnected: productId("prod_2"),
  };
});

describe("AyrshareAccountLinker", () => {
  it("creates a profile titled after the product, with the API key", async () => {
    const captured = respond("post", "profiles/profile", profileCreated);
    expect(await linker().createProfile("Acme Analytics")).toEqual({
      ok: true,
      value: { profileKey: PROFILE_KEY, refId: profileCreated.refId },
    });
    expect(captured.headers?.get("authorization")).toBe(`Bearer ${API_KEY}`);
    expect(captured.body).toEqual({ title: "Acme Analytics" });
  });

  it("asks for a linking URL that returns the founder to LaunchPilot", async () => {
    const captured = respond("post", "profiles/generateJWT", jwtCreated);
    const result = await linker().linkingUrl(PROFILE_KEY, "https://app.test/social?linked=1");
    expect(result).toEqual({ ok: true, value: jwtCreated.url });
    expect(captured.body).toEqual({
      domain: "launchpilot",
      privateKey: PRIVATE_KEY,
      profileKey: PROFILE_KEY,
      redirect: "https://app.test/social?linked=1",
      allowedSocial: ["twitter", "linkedin"],
      twitterApiKey: X_KEY,
      twitterApiSecret: X_SECRET,
    });
  });

  it("reads which of X and LinkedIn the founder linked, ignoring other networks", async () => {
    const captured = respond("get", "user", user);
    expect(await linker().linkedChannels(PROFILE_KEY)).toEqual({
      ok: true,
      value: ["x", "linkedin"],
    });
    expect(captured.headers?.get("profile-key")).toBe(PROFILE_KEY);
  });

  it.each([
    ["a rejected API key", apiKeyInvalid, 401, "rejected", false],
    ["an unknown profile key", profileKeyNotFound, 403, "rejected", false],
    ["rate limiting", rateLimited, 429, "unavailable", true],
    ["an outage", { status: "error" }, 500, "unavailable", true],
  ] as const)(
    "reports %s as %s without leaking keys",
    async (_c, body, status, code, retryable) => {
      respond("get", "user", body, status);
      const result = await linker().linkedChannels(PROFILE_KEY);
      expect(result).toMatchObject({ ok: false, error: { code, retryable } });
      const text = JSON.stringify(result);
      for (const secret of [API_KEY, PROFILE_KEY, PRIVATE_KEY]) expect(text).not.toContain(secret);
    },
  );

  it("reports an answer it cannot read as unavailable", async () => {
    server.use(
      http.post(`${BASE}/api/profiles/profile`, () => new HttpResponse("<html>oops</html>")),
    );
    expect(await linker().createProfile("Acme")).toMatchObject({
      ok: false,
      error: { code: "unavailable", retryable: true },
    });
  });

  it("reports an unreachable API as unavailable", async () => {
    server.use(http.post(`${BASE}/api/profiles/profile`, () => HttpResponse.error()));
    expect(await linker().createProfile("Acme")).toMatchObject({
      ok: false,
      error: { code: "unavailable", retryable: true },
    });
  });
});

describe("AyrsharePublisher", () => {
  it("posts the item's text to X with the profile key and the X app credentials", async () => {
    const captured = respond("post", "post", postCreated);
    const result = await publisher().publish(aPublishableItem("x"));
    expect(result).toEqual({
      ok: true,
      value: { channel: "x", externalUrl: postCreated.postIds[0]?.postUrl, publishedAt: now },
    });
    expect(captured.body).toEqual({
      post: aPublishableItem("x").body,
      platforms: ["twitter"],
    });
    expect(captured.headers?.get("authorization")).toBe(`Bearer ${API_KEY}`);
    expect(captured.headers?.get("profile-key")).toBe(PROFILE_KEY);
    expect(captured.headers?.get("x-twitter-oauth1-api-key")).toBe(X_KEY);
    expect(captured.headers?.get("x-twitter-oauth1-api-secret")).toBe(X_SECRET);
  });

  it("posts to LinkedIn without the X credentials", async () => {
    const captured = respond("post", "post", {
      ...postCreated,
      postIds: [
        {
          status: "success",
          id: "urn:li:share:7251",
          postUrl: "https://www.linkedin.com/feed/update/urn:li:share:7251",
          platform: "linkedin",
        },
      ],
    });
    const result = await publisher("linkedin").publish(aPublishableItem("linkedin"));
    expect(result.ok && result.value.externalUrl).toBe(
      "https://www.linkedin.com/feed/update/urn:li:share:7251",
    );
    expect(captured.body).toMatchObject({ platforms: ["linkedin"] });
    expect(captured.headers?.has("x-twitter-oauth1-api-key")).toBe(false);
  });

  it("falls back to the platform's home page when Ayrshare returns no post URL", async () => {
    respond("post", "post", {
      ...postCreated,
      postIds: [{ status: "success", id: "1", platform: "twitter" }],
    });
    const result = await publisher().publish(aPublishableItem("x"));
    expect(result.ok && result.value.externalUrl).toBe("https://x.com/");
  });

  it.each([
    ["duplicate content", postDuplicate, 400, "rejected_by_platform", false, "Duplicate"],
    ["an account that is not linked", postNotLinked, 400, "not_connected", false, "not linked"],
    ["missing X app credentials", xCredentialsRequired, 419, "not_connected", false, "X"],
    ["a rejected API key", apiKeyInvalid, 401, "not_connected", false, "Ayrshare"],
    ["rate limiting", rateLimited, 429, "unavailable", true, "Ayrshare"],
    ["an outage", { status: "error" }, 502, "unavailable", true, "Ayrshare"],
  ] as const)(
    "reports %s as %s without leaking keys",
    async (_case, body, status, code, retryable, mentions) => {
      respond("post", "post", body, status);
      const result = await publisher().publish(aPublishableItem("x"));
      expect(result).toMatchObject({ ok: false, error: { code, retryable } });
      if (result.ok) return;
      expect(result.error.message).toContain(mentions);
      for (const secret of [API_KEY, PROFILE_KEY, X_KEY, X_SECRET]) {
        expect(result.error.message).not.toContain(secret);
      }
    },
  );

  it("reports an answer it cannot read as unavailable", async () => {
    respond("post", "post", { postIds: "not a list" });
    expect(await publisher().publish(aPublishableItem("x"))).toMatchObject({
      ok: false,
      error: { code: "unavailable", retryable: true },
    });
  });

  it("reports an unreachable API as unavailable", async () => {
    server.use(http.post(`${BASE}/api/post`, () => HttpResponse.error()));
    expect(await publisher().publish(aPublishableItem("x"))).toMatchObject({
      ok: false,
      error: { code: "unavailable", retryable: true },
    });
  });
});

describe("AyrsharePublisherProvider", () => {
  it("refuses a product whose profile has not linked the provider's channel", async () => {
    const profiles = new InMemorySocialProfileRepository();
    await profiles.save(withLinkedChannels(aSocialProfile(), ["linkedin"]));
    const provider = new AyrsharePublisherProvider("x", profiles, new FakeTokenCipher(), options);
    expect(await provider.forProduct(productId("prod_1"))).toMatchObject({
      ok: false,
      error: { code: "not_connected", message: "Link your X account first", retryable: false },
    });
  });
});
