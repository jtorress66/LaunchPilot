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
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  AesGcmTokenCipher,
  WordPressConnectionVerifier,
  WordPressPublisher,
  WordPressPublisherProvider,
} from "../../src";
import cannotCreate from "./recorded/error-cannot-create.json";
import incorrectPassword from "./recorded/error-incorrect-password.json";
import invalidParam from "./recorded/error-invalid-param.json";
import index from "./recorded/index.json";
import postCreated from "./recorded/post-created.json";
import usersMeContributor from "./recorded/users-me-contributor.json";
import usersMe from "./recorded/users-me.json";

const USER = "admin";
const APP_PASSWORD = "abcd efgh ijkl mnop qrst uvwx";
const now = new Date("2026-10-12T16:00:00.000Z");

interface Received {
  route: string | null;
  method: string;
  authorization: string | undefined;
  contentType: string | undefined;
  body: string;
}

type Route = (req: IncomingMessage, res: ServerResponse) => void;

/** A local WordPress that replays recorded REST responses, keyed by `rest_route`. */
const blog = { routes: new Map<string, Route>(), received: [] as Received[] };
let server: Server;
let site: string;

const withSite = (json: unknown) =>
  JSON.parse(JSON.stringify(json).replaceAll("SITE_URL", site)) as unknown;

const json =
  (status: number, payload: unknown): Route =>
  (_req, res) => {
    res.writeHead(status, { "content-type": "application/json; charset=UTF-8" });
    res.end(JSON.stringify(withSite(payload)));
  };

const authorised = (req: IncomingMessage) =>
  req.headers.authorization ===
  `Basic ${Buffer.from(`${USER}:${APP_PASSWORD}`).toString("base64")}`;

/** The happy path of a WordPress site with Application Passwords. */
const serveWordPress = () => {
  blog.routes.set("/", json(200, index));
  blog.routes.set("/wp/v2/users/me", (req, res) => {
    json(authorised(req) ? 200 : 401, authorised(req) ? usersMe : incorrectPassword)(req, res);
  });
  blog.routes.set("/wp/v2/posts", (req, res) => {
    json(authorised(req) ? 201 : 401, authorised(req) ? postCreated : incorrectPassword)(req, res);
  });
};

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://blog");
    const route = url.searchParams.get("rest_route");
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => {
      blog.received.push({
        route,
        method: req.method ?? "",
        authorization: req.headers.authorization,
        contentType: req.headers["content-type"],
        body,
      });
      const handler = route === null ? undefined : blog.routes.get(route);
      if (handler) handler(req, res);
      else res.writeHead(404, { "content-type": "text/html" }).end("<h1>Not Found</h1>");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  site = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});
beforeEach(() => {
  blog.routes.clear();
  blog.received = [];
  serveWordPress();
});

const network = { allowPrivateNetwork: true, timeoutMs: 2_000 };
const verifier = (options = network) => new WordPressConnectionVerifier(options);
const publisher = (options = network) =>
  new WordPressPublisher(
    { siteUrl: site, username: USER, password: APP_PASSWORD },
    { ...options, clock: new FixedClock(now) },
  );
const credentials = () => ({ siteUrl: site, username: USER, secret: APP_PASSWORD });

describeBlogConnectionVerifierContract("WordPressConnectionVerifier (recorded REST API)", () => ({
  verifier: verifier(),
  get valid() {
    return credentials();
  },
}));

describePublisherContract("WordPressPublisher (recorded REST API)", () => ({
  publisher: publisher(),
  givenOutage: () => {
    blog.routes.set("/wp/v2/posts", json(500, { code: "internal_server_error" }));
  },
}));

describePublisherProviderContract("WordPressPublisherProvider", async () => {
  const cipher = new AesGcmTokenCipher(randomBytes(32).toString("base64"));
  const connections = new InMemoryChannelConnectionRepository();
  await connections.save({
    ...aBlogConnection({ siteUrl: site }),
    encryptedSecret: await cipher.encrypt(APP_PASSWORD),
  });
  return {
    provider: new WordPressPublisherProvider(connections, cipher, {
      ...network,
      clock: new FixedClock(now),
    }),
    connected: productId("prod_1"),
    unconnected: productId("prod_2"),
  };
});

describe("WordPressConnectionVerifier", () => {
  it("names the site and returns the address WordPress reports for itself", async () => {
    expect(await verifier().verify({ ...credentials(), siteUrl: site.replace(/\/$/, "") })).toEqual(
      {
        ok: true,
        value: { siteName: "Acme Blog", siteUrl: site },
      },
    );
    expect(blog.received.map((r) => r.route)).toEqual(["/", "/wp/v2/users/me"]);
  });

  it.each([
    ["a site that is not WordPress", () => blog.routes.delete("/")],
    [
      "a REST API without wp/v2",
      () => blog.routes.set("/", json(200, { ...index, namespaces: [] })),
    ],
  ])("reports %s as not_wordpress", async (_case, arrange) => {
    arrange();
    expect(await verifier().verify(credentials())).toMatchObject({
      ok: false,
      error: { code: "not_wordpress", retryable: false },
    });
  });

  it("refuses a user who cannot publish posts", async () => {
    blog.routes.set("/wp/v2/users/me", json(200, usersMeContributor));
    expect(await verifier().verify(credentials())).toEqual({
      ok: false,
      error: {
        code: "invalid_credentials",
        message:
          "This WordPress user cannot publish posts. Use an Editor or Administrator account.",
        retryable: false,
      },
    });
  });

  it("reports a site that cannot be reached", async () => {
    const closed = await verifier().verify({ ...credentials(), siteUrl: "http://127.0.0.1:1/" });
    expect(closed).toMatchObject({ ok: false, error: { code: "unreachable", retryable: true } });
  });

  it("refuses a private address when private networking is off", async () => {
    const result = await verifier({ ...network, allowPrivateNetwork: false }).verify(credentials());
    expect(result).toMatchObject({ ok: false, error: { code: "blocked", retryable: false } });
    expect(blog.received).toEqual([]);
  });
});

describe("WordPressPublisher", () => {
  it("publishes the article as HTML with Basic auth and returns the post's link", async () => {
    const item = aPublishableItem("blog");
    expect(await publisher().publish(item)).toEqual({
      ok: true,
      value: { channel: "blog", externalUrl: `${site}?p=42`, publishedAt: now },
    });
    const [sent] = blog.received;
    expect(sent).toMatchObject({ route: "/wp/v2/posts", method: "POST" });
    expect(sent?.contentType).toBe("application/json");
    expect(sent?.authorization).toBe(
      `Basic ${Buffer.from(`${USER}:${APP_PASSWORD}`).toString("base64")}`,
    );
    expect(JSON.parse(sent?.body ?? "{}")).toEqual({
      title: item.title,
      content: `<p>${item.body}</p>\n`,
      status: "publish",
    });
  });

  it("sends the article's URL slug and excerpt when it has them", async () => {
    const item = {
      ...aPublishableItem("blog"),
      seo: { slug: "cookieless-analytics", excerpt: "Five numbers a week, no cookies." },
    } as PublishableContentItem;
    await publisher().publish(item);
    expect(JSON.parse(blog.received[0]?.body ?? "{}")).toMatchObject({
      slug: "cookieless-analytics",
      excerpt: "Five numbers a week, no cookies.",
    });
  });

  it.each([
    ["a rejected password", 401, incorrectPassword, "not_connected", false],
    ["a user without permission", 401, cannotCreate, "not_connected", false],
    ["an invalid post", 400, invalidParam, "rejected_by_platform", false],
    ["a server error", 500, { code: "internal_server_error" }, "unavailable", true],
    ["a rate limit", 429, { code: "too_many_requests" }, "unavailable", true],
  ] as const)("reports %s (HTTP %i) as %s", async (_case, status, payload, code, retryable) => {
    blog.routes.set("/wp/v2/posts", json(status, payload));
    const result = await publisher().publish(aPublishableItem("blog"));
    expect(result).toMatchObject({ ok: false, error: { code, retryable } });
    if (result.ok) return;
    expect(result.error.message).not.toContain(APP_PASSWORD);
  });

  it("explains WordPress's own reason when it rejects a post", async () => {
    blog.routes.set("/wp/v2/posts", json(400, invalidParam));
    const result = await publisher().publish(aPublishableItem("blog"));
    expect(result.ok ? undefined : result.error.message).toBe(
      "WordPress rejected the post: Invalid parameter(s): status",
    );
  });

  it("does not follow a redirect with the post, and asks to reconnect", async () => {
    blog.routes.set("/wp/v2/posts", (_req, res) => {
      res.writeHead(301, { location: "https://elsewhere.example/" }).end();
    });
    expect(await publisher().publish(aPublishableItem("blog"))).toMatchObject({
      ok: false,
      error: { code: "rejected_by_platform", retryable: false },
    });
    expect(blog.received).toHaveLength(1);
  });

  it("reports a blog that does not answer in time as unavailable", async () => {
    blog.routes.set("/wp/v2/posts", () => {
      // Never responds.
    });
    const result = await publisher({ ...network, timeoutMs: 200 }).publish(
      aPublishableItem("blog"),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "unavailable", retryable: true } });
  });

  it("reports a reply without a valid link as unavailable", async () => {
    blog.routes.set("/wp/v2/posts", json(201, { id: 1, link: "not a url" }));
    const result = await publisher().publish(aPublishableItem("blog"));
    expect(result).toMatchObject({ ok: false, error: { code: "unavailable" } });
  });

  it("refuses a private address when private networking is off", async () => {
    const result = await publisher({ ...network, allowPrivateNetwork: false }).publish(
      aPublishableItem("blog"),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "not_connected", retryable: false } });
    expect(blog.received).toEqual([]);
  });
});
