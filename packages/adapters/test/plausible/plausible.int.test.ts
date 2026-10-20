import { productId, type MetricsSnapshot } from "@launchpilot/domain";
import {
  aPlausibleConnection,
  FakeTokenCipher,
  InMemoryAnalyticsConnectionRepository,
} from "@launchpilot/testing";
import {
  describeMetricsSourceContract,
  describePlausibleSiteVerifierContract,
} from "@launchpilot/testing/contracts";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PlausibleSource, PlausibleStatsVerifier } from "../../src";
import invalidKey from "./recorded/invalid-key.json";
import pagesW42 from "./recorded/pages-w42.json";
import siteNotFound from "./recorded/site-not-found.json";
import totalsW42 from "./recorded/totals-w42.json";

const KEY = "plausible-recorded-key";
const SITE = "acme.dev";
const network = { allowPrivateNetwork: true };
const week = {
  productId: productId("prod_1"),
  from: new Date("2026-10-12T00:00:00.000Z"),
  to: new Date("2026-10-19T00:00:00.000Z"),
};

interface Query {
  site_id: string;
  metrics: string[];
  date_range: string | string[];
  dimensions?: string[];
}

type Handler = (query: Query) => { status: number; body: unknown };

/** A local Plausible that replays recorded Stats API v2 responses. */
const plausible = {
  handler: (() => ({ status: 200, body: totalsW42 })) as Handler,
  received: [] as { path: string; authorization: string | undefined; query: Query }[],
};
let server: Server;
let baseUrl: string;

const respond = (req: IncomingMessage, res: ServerResponse, text: string) => {
  const query = JSON.parse(text) as Query;
  plausible.received.push({ path: req.url ?? "", authorization: req.headers.authorization, query });
  const { status, body } =
    req.headers.authorization !== `Bearer ${KEY}`
      ? { status: 401, body: invalidKey }
      : query.site_id !== SITE
        ? { status: 401, body: siteNotFound }
        : plausible.handler(query);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

beforeAll(async () => {
  server = createServer((req, res) => {
    let text = "";
    req.on("data", (chunk: Buffer) => (text += chunk.toString()));
    req.on("end", () => {
      respond(req, res, text);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}/`;
});
afterAll(() => {
  server.close();
});
beforeEach(() => {
  plausible.handler = (q) => ({ status: 200, body: q.dimensions?.length ? pagesW42 : totalsW42 });
  plausible.received = [];
});

const cipher = new FakeTokenCipher();
const connectedRepo = async () => {
  const repo = new InMemoryAnalyticsConnectionRepository();
  const connection = { ...aPlausibleConnection(), baseUrl };
  await repo.save({ ...connection, encryptedSecret: await cipher.encrypt(KEY) });
  return repo;
};

const totals = (values: MetricsSnapshot["values"]) => ({
  ...totalsW42,
  results: [{ metrics: [values.visitors ?? 0, values.pageviews ?? 0], dimensions: [] }],
});

describeMetricsSourceContract("PlausibleSource (recorded API)", async () => {
  const repo = await connectedRepo();
  return {
    source: new PlausibleSource(repo, cipher, network),
    metrics: ["visitors", "pageviews"],
    givenWeek: (values) => {
      plausible.handler = (q) => ({
        status: 200,
        body: q.dimensions?.length ? { ...pagesW42, results: [] } : totals(values),
      });
    },
    givenNotConnected: () => repo.delete(productId("prod_1"), "plausible"),
    givenFailure: () => {
      plausible.handler = () => ({ status: 503, body: { error: "Service unavailable" } });
    },
  };
});

describePlausibleSiteVerifierContract("PlausibleStatsVerifier (recorded API)", () => ({
  verifier: new PlausibleStatsVerifier(network),
  valid: { baseUrl, siteId: SITE, apiKey: KEY },
}));

describe("PlausibleSource", () => {
  it("queries the site's visitors, pageviews and top pages for the week's dates", async () => {
    await new PlausibleSource(await connectedRepo(), cipher, network).fetch(week);
    expect(plausible.received.map((r) => [r.path, r.authorization])).toEqual([
      ["/api/v2/query", `Bearer ${KEY}`],
      ["/api/v2/query", `Bearer ${KEY}`],
    ]);
    expect(plausible.received.map((r) => r.query)).toEqual([
      {
        site_id: SITE,
        metrics: ["visitors", "pageviews"],
        date_range: ["2026-10-12", "2026-10-18"],
      },
      {
        site_id: SITE,
        metrics: ["visitors"],
        date_range: ["2026-10-12", "2026-10-18"],
        dimensions: ["event:page"],
        order_by: [["visitors", "desc"]],
        pagination: { limit: 10 },
      },
    ]);
  });

  it("maps the recorded response", async () => {
    const result = await new PlausibleSource(await connectedRepo(), cipher, network).fetch(week);
    expect(result).toEqual({
      ok: true,
      value: {
        source: "plausible",
        from: week.from,
        to: week.to,
        values: { visitors: 1388, pageviews: 3790 },
        topPages: [
          { url: "/", visitors: 790 },
          { url: "/pricing", visitors: 221 },
          { url: "/blog/cookieless-analytics", visitors: 205 },
        ],
        topQueries: [],
      },
    });
  });

  it("reports a rejected key as invalid_credentials without echoing it", async () => {
    const repo = await connectedRepo();
    const connection = await repo.find(productId("prod_1"), "plausible");
    if (!connection) throw new Error("fixture missing");
    await repo.save({ ...connection, encryptedSecret: await cipher.encrypt("revoked-key") });
    const result = await new PlausibleSource(repo, cipher, network).fetch(week);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid_credentials", message: "Plausible rejected the API key" },
    });
    expect(JSON.stringify(result)).not.toContain("revoked-key");
  });

  it("refuses a private address unless the network policy allows it", async () => {
    const source = new PlausibleSource(await connectedRepo(), cipher, {
      allowPrivateNetwork: false,
    });
    expect(await source.fetch(week)).toMatchObject({
      ok: false,
      error: { code: "unavailable", message: expect.stringContaining("cannot reach") as unknown },
    });
  });
});

describe("PlausibleStatsVerifier", () => {
  it("checks the site with a one-day query", async () => {
    await new PlausibleStatsVerifier(network).verify({ baseUrl, siteId: SITE, apiKey: KEY });
    expect(plausible.received.map((r) => r.query)).toEqual([
      { site_id: SITE, metrics: ["visitors"], date_range: "day" },
    ]);
  });

  it("refuses a private address as blocked", async () => {
    expect(
      await new PlausibleStatsVerifier({ allowPrivateNetwork: false }).verify({
        baseUrl,
        siteId: SITE,
        apiKey: KEY,
      }),
    ).toMatchObject({ ok: false, error: { code: "blocked" } });
  });
});

describe("Plausible failure paths", () => {
  const source = async () => new PlausibleSource(await connectedRepo(), cipher, network);
  const verify = (siteId = SITE) =>
    new PlausibleStatsVerifier(network).verify({ baseUrl, siteId, apiKey: KEY });

  it.each([
    ["a 401 that names the site", { status: 401, body: siteNotFound }, "no_access", false],
    ["a 401 that is not JSON", { status: 401, body: "nope" }, "invalid_credentials", false],
    ["a 404", { status: 404, body: {} }, "no_access", false],
    ["a rate limit", { status: 429, body: {} }, "unavailable", true],
    [
      "a 200 that is not the expected shape",
      { status: 200, body: { results: "x" } },
      "unavailable",
      false,
    ],
  ] as const)("reports %s during a report as %s", async (_case, response, code, retryable) => {
    plausible.handler = () => response;
    expect(await (await source()).fetch(week)).toMatchObject({
      ok: false,
      error: { code, retryable },
    });
  });

  it("reports a failed top-pages query even when the totals worked", async () => {
    plausible.handler = (q) =>
      q.dimensions?.length ? { status: 500, body: {} } : { status: 200, body: totalsW42 };
    expect(await (await source()).fetch(week)).toMatchObject({
      ok: false,
      error: { code: "unavailable" },
    });
  });

  it("reports a Plausible that cannot be reached", async () => {
    const repo = await connectedRepo();
    const connection = await repo.find(productId("prod_1"), "plausible");
    if (!connection) throw new Error("fixture missing");
    await repo.save({ ...connection, baseUrl: "http://127.0.0.1:9/" });
    expect(await new PlausibleSource(repo, cipher, network).fetch(week)).toMatchObject({
      ok: false,
      error: { code: "unavailable", message: "Plausible could not be reached", retryable: true },
    });
  });

  it("skips page rows without a path", async () => {
    plausible.handler = (q) => ({
      status: 200,
      body: q.dimensions?.length
        ? { results: [{ metrics: [5], dimensions: [""] }] }
        : { results: [] },
    });
    const result = await (await source()).fetch(week);
    expect(result.ok && result.value).toMatchObject({
      values: { visitors: 0, pageviews: 0 },
      topPages: [],
    });
  });

  it("explains an unreachable or failing Plausible while connecting", async () => {
    plausible.handler = () => ({ status: 500, body: {} });
    expect(await verify()).toMatchObject({
      ok: false,
      error: { code: "unreachable", retryable: true },
    });
    expect(
      await new PlausibleStatsVerifier(network).verify({
        baseUrl: "http://127.0.0.1:9/",
        siteId: SITE,
        apiKey: KEY,
      }),
    ).toMatchObject({ ok: false, error: { code: "unreachable" } });
  });
});
