import { productId, type MetricsSnapshot } from "@launchpilot/domain";
import {
  aGoogleConnection,
  FakeTokenCipher,
  InMemoryAnalyticsConnectionRepository,
} from "@launchpilot/testing";
import {
  describeAnalyticsPropertyListerContract,
  describeGoogleAuthorizerContract,
  describeMetricsSourceContract,
} from "@launchpilot/testing/contracts";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  Ga4Source,
  GoogleOAuthAuthorizer,
  GooglePropertyLister,
  SearchConsoleSource,
  type GoogleOptions,
} from "../../src";
import accountSummaries from "./recorded/account-summaries.json";
import ga4Empty from "./recorded/ga4-empty.json";
import ga4PagesW42 from "./recorded/ga4-pages-w42.json";
import ga4TotalsW42 from "./recorded/ga4-totals-w42.json";
import gscEmpty from "./recorded/gsc-empty.json";
import gscQueriesW42 from "./recorded/gsc-queries-w42.json";
import gscTotalsW42 from "./recorded/gsc-totals-w42.json";
import invalidGrant from "./recorded/invalid-grant.json";
import permissionDenied from "./recorded/permission-denied.json";
import serverError from "./recorded/server-error.json";
import sites from "./recorded/sites.json";
import tokenExchangeNoScopes from "./recorded/token-exchange-no-scopes.json";
import tokenExchange from "./recorded/token-exchange.json";
import tokenRefresh from "./recorded/token-refresh.json";

const options: GoogleOptions = {
  clientId: "recorded-client.apps.googleusercontent.com",
  clientSecret: "recorded-client-secret",
};
const TOKEN = "https://oauth2.googleapis.com/token";
const GSC = "https://www.googleapis.com/webmasters/v3";
const DATA = "https://analyticsdata.googleapis.com/v1beta";
const ADMIN = "https://analyticsadmin.googleapis.com/v1beta";
const REFRESH = "1//recorded-refresh-token";
const ACCESS = "ya29.recorded-access-token";
const week = {
  productId: productId("prod_1"),
  from: new Date("2026-10-12T00:00:00.000Z"),
  to: new Date("2026-10-19T00:00:00.000Z"),
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

/** Google's token endpoint: valid codes and refresh tokens, everything else `invalid_grant`. */
const tokenEndpoint = (exchange: JsonBodyType = tokenExchange) => {
  const forms: URLSearchParams[] = [];
  server.use(
    http.post(TOKEN, async ({ request }) => {
      const form = new URLSearchParams(await request.text());
      forms.push(form);
      const grant = form.get("grant_type");
      if (grant === "authorization_code" && form.get("code") === "4/recorded-code") {
        return HttpResponse.json(exchange);
      }
      if (grant === "refresh_token" && form.get("refresh_token") === REFRESH) {
        return HttpResponse.json(tokenRefresh);
      }
      return HttpResponse.json(invalidGrant, { status: 400 });
    }),
  );
  return forms;
};

const authorised = (request: Request) =>
  request.headers.get("authorization") === `Bearer ${ACCESS}`;

const cipher = new FakeTokenCipher();
const connectedRepo = async (connection = aGoogleConnection()) => {
  const repo = new InMemoryAnalyticsConnectionRepository();
  await repo.save({ ...connection, encryptedSecret: await cipher.encrypt(REFRESH) });
  return repo;
};

describeGoogleAuthorizerContract("GoogleOAuthAuthorizer (recorded API)", () => {
  tokenEndpoint();
  return { authorizer: new GoogleOAuthAuthorizer(options), validCode: "4/recorded-code" };
});

describeAnalyticsPropertyListerContract("GooglePropertyLister (recorded API)", () => {
  tokenEndpoint();
  server.use(
    http.get(`${GSC}/sites`, () => HttpResponse.json(sites)),
    http.get(`${ADMIN}/accountSummaries`, () => HttpResponse.json(accountSummaries)),
  );
  return { lister: new GooglePropertyLister(options), validToken: REFRESH };
});

const searchRows = (values: MetricsSnapshot["values"]) => ({
  rows: [
    {
      clicks: values.search_clicks,
      impressions: values.search_impressions,
      ctr: values.search_ctr,
      position: values.search_position,
    },
  ],
  responseAggregationType: "byProperty",
});

describeMetricsSourceContract("SearchConsoleSource (recorded API)", async () => {
  tokenEndpoint();
  const repo = await connectedRepo();
  return {
    source: new SearchConsoleSource(repo, cipher, options),
    metrics: ["search_clicks", "search_impressions", "search_ctr", "search_position"],
    givenWeek: (values) => {
      server.use(
        http.post(`${GSC}/sites/:site/searchAnalytics/query`, async ({ request }) => {
          const body = (await request.json()) as { dimensions?: string[] };
          return HttpResponse.json(body.dimensions?.length ? gscEmpty : searchRows(values));
        }),
      );
    },
    givenNotConnected: () => repo.delete(productId("prod_1"), "google"),
    givenFailure: () => {
      server.use(
        http.post(`${GSC}/sites/:site/searchAnalytics/query`, () =>
          HttpResponse.json(serverError, { status: 503 }),
        ),
      );
    },
  };
});

const ga4Totals = (values: MetricsSnapshot["values"]) => ({
  ...ga4TotalsW42,
  rows: [
    {
      metricValues: [
        { value: String(values.visitors ?? 0) },
        { value: String(values.pageviews ?? 0) },
      ],
    },
  ],
});

describeMetricsSourceContract("Ga4Source (recorded API)", async () => {
  tokenEndpoint();
  const repo = await connectedRepo();
  return {
    source: new Ga4Source(repo, cipher, options),
    metrics: ["visitors", "pageviews"],
    givenWeek: (values) => {
      server.use(
        http.post(`${DATA}/properties/:report`, async ({ request }) => {
          const body = (await request.json()) as { dimensions?: unknown[] };
          return HttpResponse.json(body.dimensions ? ga4Empty : ga4Totals(values));
        }),
      );
    },
    givenNotConnected: () => repo.delete(productId("prod_1"), "google"),
    givenFailure: () => {
      server.use(
        http.post(`${DATA}/properties/:report`, () =>
          HttpResponse.json(permissionDenied, { status: 403 }),
        ),
      );
    },
  };
});

describe("GoogleOAuthAuthorizer", () => {
  it("asks Google for read-only, offline access with a fresh consent", () => {
    const url = new URL(
      new GoogleOAuthAuthorizer(options).authorizationUrl({
        state: "st_1",
        redirectUrl: "https://app.test/api/google/callback",
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: options.clientId,
      redirect_uri: "https://app.test/api/google/callback",
      response_type: "code",
      scope:
        "openid email https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state: "st_1",
    });
  });

  it("exchanges the code with the client credentials and reads the email from the id token", async () => {
    const forms = tokenEndpoint();
    const result = await new GoogleOAuthAuthorizer(options).exchangeCode({
      code: "4/recorded-code",
      redirectUrl: "https://app.test/api/google/callback",
    });
    expect(result).toEqual({
      ok: true,
      value: { refreshToken: REFRESH, accountEmail: "founder@acme.dev" },
    });
    expect(Object.fromEntries(forms[0] ?? [])).toEqual({
      code: "4/recorded-code",
      client_id: options.clientId,
      client_secret: options.clientSecret,
      redirect_uri: "https://app.test/api/google/callback",
      grant_type: "authorization_code",
    });
  });

  it("refuses a grant without Search Console or Analytics access as missing_scope", async () => {
    tokenEndpoint(tokenExchangeNoScopes);
    expect(
      await new GoogleOAuthAuthorizer(options).exchangeCode({
        code: "4/recorded-code",
        redirectUrl: "https://app.test/cb",
      }),
    ).toMatchObject({ ok: false, error: { code: "missing_scope" } });
  });

  it("reports an unreachable Google as unavailable, without the client secret", async () => {
    server.use(http.post(TOKEN, () => HttpResponse.error()));
    const result = await new GoogleOAuthAuthorizer(options).exchangeCode({
      code: "4/recorded-code",
      redirectUrl: "https://app.test/cb",
    });
    expect(result).toMatchObject({ ok: false, error: { code: "unavailable", retryable: true } });
    expect(JSON.stringify(result)).not.toContain(options.clientSecret);
  });
});

describe("GooglePropertyLister", () => {
  it("lists verified Search Console sites and GA4 properties by number", async () => {
    tokenEndpoint();
    server.use(
      http.get(`${GSC}/sites`, ({ request }) =>
        authorised(request) ? HttpResponse.json(sites) : new HttpResponse(null, { status: 401 }),
      ),
      http.get(`${ADMIN}/accountSummaries`, () => HttpResponse.json(accountSummaries)),
    );
    expect(await new GooglePropertyLister(options).list(REFRESH)).toEqual({
      ok: true,
      value: {
        searchConsoleSites: [
          { siteUrl: "sc-domain:acme.dev" },
          { siteUrl: "https://blog.acme.dev/" },
        ],
        ga4Properties: [{ id: "412345678", name: "acme.dev - GA4", account: "Acme" }],
      },
    });
  });
});

describe("SearchConsoleSource", () => {
  const queries = () => {
    const bodies: unknown[] = [];
    const sites: string[] = [];
    server.use(
      http.post(`${GSC}/sites/:site/searchAnalytics/query`, async ({ request, params }) => {
        const body = (await request.json()) as { dimensions?: string[] };
        bodies.push(body);
        sites.push(String(params.site));
        if (!authorised(request)) return new HttpResponse(null, { status: 401 });
        return HttpResponse.json(body.dimensions?.length ? gscQueriesW42 : gscTotalsW42);
      }),
    );
    return { bodies, sites };
  };

  it("asks for the week's totals and top queries, with an inclusive end date", async () => {
    tokenEndpoint();
    const { bodies, sites } = queries();
    await new SearchConsoleSource(await connectedRepo(), cipher, options).fetch(week);
    expect(sites).toEqual(["sc-domain:acme.dev", "sc-domain:acme.dev"]);
    expect(bodies).toEqual([
      { startDate: "2026-10-12", endDate: "2026-10-18", type: "web" },
      {
        startDate: "2026-10-12",
        endDate: "2026-10-18",
        type: "web",
        dimensions: ["query"],
        rowLimit: 10,
      },
    ]);
  });

  it("maps totals and queries from the recorded response", async () => {
    tokenEndpoint();
    queries();
    const result = await new SearchConsoleSource(await connectedRepo(), cipher, options).fetch(
      week,
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        source: "search_console",
        values: {
          search_clicks: 182,
          search_impressions: 6240,
          search_ctr: 182 / 6240,
          search_position: 17.43,
        },
        topPages: [],
      },
    });
    expect(result.ok && result.value.topQueries[0]).toEqual({
      query: "cookieless analytics",
      clicks: 41,
      impressions: 820,
      position: 4.2,
    });
  });

  it("reports an empty week as zero clicks and impressions, with no CTR or position", async () => {
    tokenEndpoint();
    server.use(
      http.post(`${GSC}/sites/:site/searchAnalytics/query`, () => HttpResponse.json(gscEmpty)),
    );
    const result = await new SearchConsoleSource(await connectedRepo(), cipher, options).fetch(
      week,
    );
    expect(result.ok && result.value.values).toEqual({ search_clicks: 0, search_impressions: 0 });
  });

  it("is not connected when no Search Console property was chosen", async () => {
    const repo = await connectedRepo(aGoogleConnection({ searchConsoleSite: null }));
    expect(await new SearchConsoleSource(repo, cipher, options).fetch(week)).toMatchObject({
      ok: false,
      error: { code: "not_connected" },
    });
  });

  it.each([
    ["a revoked refresh token", "invalid_credentials", 400],
    ["a property the account lost access to", "no_access", 403],
  ] as const)("reports %s as %s", async (_case, code, status) => {
    if (status === 400) {
      server.use(http.post(TOKEN, () => HttpResponse.json(invalidGrant, { status })));
    } else {
      tokenEndpoint();
      server.use(
        http.post(`${GSC}/sites/:site/searchAnalytics/query`, () =>
          HttpResponse.json(permissionDenied, { status }),
        ),
      );
    }
    const result = await new SearchConsoleSource(await connectedRepo(), cipher, options).fetch(
      week,
    );
    expect(result).toMatchObject({ ok: false, error: { code, retryable: false } });
    expect(JSON.stringify(result)).not.toContain(REFRESH);
  });
});

describe("Ga4Source", () => {
  it("asks the property for active users, pageviews and top pages for the week", async () => {
    tokenEndpoint();
    const calls: { report: string; body: unknown }[] = [];
    server.use(
      http.post(`${DATA}/properties/:report`, async ({ request, params }) => {
        const body = (await request.json()) as { dimensions?: unknown[] };
        calls.push({ report: String(params.report), body });
        return HttpResponse.json(body.dimensions ? ga4PagesW42 : ga4TotalsW42);
      }),
    );
    const result = await new Ga4Source(await connectedRepo(), cipher, options).fetch(week);
    expect(calls.map((c) => c.report)).toEqual(["123456789:runReport", "123456789:runReport"]);
    expect(calls[0]?.body).toEqual({
      dateRanges: [{ startDate: "2026-10-12", endDate: "2026-10-18" }],
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
    });
    expect(calls[1]?.body).toEqual({
      dateRanges: [{ startDate: "2026-10-12", endDate: "2026-10-18" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 10,
    });
    expect(result).toMatchObject({
      ok: true,
      value: { source: "ga4", values: { visitors: 1432, pageviews: 3876 }, topQueries: [] },
    });
    expect(result.ok && result.value.topPages.slice(0, 2)).toEqual([
      { url: "/", visitors: 812 },
      { url: "/pricing", visitors: 233 },
    ]);
  });

  it("reports an empty week as zero", async () => {
    tokenEndpoint();
    server.use(http.post(`${DATA}/properties/:report`, () => HttpResponse.json(ga4Empty)));
    const result = await new Ga4Source(await connectedRepo(), cipher, options).fetch(week);
    expect(result.ok && result.value.values).toEqual({ visitors: 0, pageviews: 0 });
  });

  it("is not connected when no GA4 property was chosen", async () => {
    const repo = await connectedRepo(aGoogleConnection({ ga4PropertyId: null }));
    expect(await new Ga4Source(repo, cipher, options).fetch(week)).toMatchObject({
      ok: false,
      error: { code: "not_connected" },
    });
  });

  it("reports a Google outage as unavailable and retryable", async () => {
    tokenEndpoint();
    server.use(
      http.post(`${DATA}/properties/:report`, () =>
        HttpResponse.json(serverError, { status: 503 }),
      ),
    );
    expect(await new Ga4Source(await connectedRepo(), cipher, options).fetch(week)).toMatchObject({
      ok: false,
      error: { code: "unavailable", retryable: true },
    });
  });
});

describe("Google failure paths", () => {
  const exchange = () =>
    new GoogleOAuthAuthorizer(options).exchangeCode({
      code: "4/recorded-code",
      redirectUrl: "https://app.test/cb",
    });

  it.each([
    ["a server error", HttpResponse.json(serverError, { status: 500 }), "unavailable"],
    [
      "an id token without an email",
      HttpResponse.json({ ...tokenExchange, id_token: "a.e30.c" }),
      "unavailable",
    ],
    [
      "an id token that is not a JWT",
      HttpResponse.json({ ...tokenExchange, id_token: "garbage" }),
      "unavailable",
    ],
  ] as const)("reports %s during sign-in as %s", async (_case, response, code) => {
    server.use(http.post(TOKEN, () => response));
    expect(await exchange()).toMatchObject({ ok: false, error: { code } });
  });

  it("reports a token endpoint outage during a report as unavailable and retryable", async () => {
    server.use(http.post(TOKEN, () => HttpResponse.json(serverError, { status: 503 })));
    expect(await new Ga4Source(await connectedRepo(), cipher, options).fetch(week)).toMatchObject({
      ok: false,
      error: { code: "unavailable", retryable: true },
    });
  });

  it("follows the GA4 account list across pages", async () => {
    tokenEndpoint();
    const pageTokens: (string | null)[] = [];
    server.use(
      http.get(`${GSC}/sites`, () => HttpResponse.json({})),
      http.get(`${ADMIN}/accountSummaries`, ({ request }) => {
        const token = new URL(request.url).searchParams.get("pageToken");
        pageTokens.push(token);
        return HttpResponse.json(
          token === null ? { ...accountSummaries, nextPageToken: "page-2" } : accountSummaries,
        );
      }),
    );
    const result = await new GooglePropertyLister(options).list(REFRESH);
    expect(pageTokens).toEqual([null, "page-2"]);
    expect(result.ok && result.value.searchConsoleSites).toEqual([]);
    expect(result.ok && result.value.ga4Properties).toHaveLength(2);
  });

  it.each([
    ["Search Console", `${GSC}/sites`],
    ["Analytics Admin", `${ADMIN}/accountSummaries`],
  ] as const)("reports a %s failure while listing properties", async (_name, failing) => {
    tokenEndpoint();
    server.use(
      http.get(`${GSC}/sites`, () =>
        failing.endsWith("/sites")
          ? HttpResponse.json(serverError, { status: 500 })
          : HttpResponse.json(sites),
      ),
      http.get(`${ADMIN}/accountSummaries`, () =>
        failing.endsWith("Summaries") ? HttpResponse.error() : HttpResponse.json(accountSummaries),
      ),
    );
    expect(await new GooglePropertyLister(options).list(REFRESH)).toMatchObject({
      ok: false,
      error: { code: "unavailable" },
    });
  });

  it("reports an expired access token mid-report as invalid_credentials", async () => {
    tokenEndpoint();
    server.use(
      http.post(
        `${GSC}/sites/:site/searchAnalytics/query`,
        () => new HttpResponse("nope", { status: 401 }),
      ),
    );
    expect(
      await new SearchConsoleSource(await connectedRepo(), cipher, options).fetch(week),
    ).toMatchObject({ ok: false, error: { code: "invalid_credentials", retryable: false } });
  });

  it("reports a failed top-queries call even when the totals worked", async () => {
    tokenEndpoint();
    server.use(
      http.post(`${GSC}/sites/:site/searchAnalytics/query`, async ({ request }) => {
        const body = (await request.json()) as { dimensions?: string[] };
        return body.dimensions
          ? HttpResponse.json(serverError, { status: 429 })
          : HttpResponse.json(gscTotalsW42);
      }),
    );
    expect(
      await new SearchConsoleSource(await connectedRepo(), cipher, options).fetch(week),
    ).toMatchObject({ ok: false, error: { code: "unavailable", retryable: true } });
  });

  it("reports GA4 failures on either call, and skips page rows without a path", async () => {
    tokenEndpoint();
    server.use(
      http.post(`${DATA}/properties/:report`, async ({ request }) => {
        const body = (await request.json()) as { dimensions?: unknown[] };
        return body.dimensions ? HttpResponse.error() : HttpResponse.json(ga4TotalsW42);
      }),
    );
    const source = new Ga4Source(await connectedRepo(), cipher, options);
    expect(await source.fetch(week)).toMatchObject({ ok: false, error: { code: "unavailable" } });

    server.use(
      http.post(`${DATA}/properties/:report`, async ({ request }) => {
        const body = (await request.json()) as { dimensions?: unknown[] };
        return HttpResponse.json(
          body.dimensions
            ? { rows: [{ dimensionValues: [{ value: "" }], metricValues: [{ value: "9" }] }] }
            : { rows: [] },
        );
      }),
    );
    const empty = await source.fetch(week);
    expect(empty.ok && empty.value).toMatchObject({
      values: { visitors: 0, pageviews: 0 },
      topPages: [],
    });

    server.use(
      http.post(`${DATA}/properties/:report`, () => new HttpResponse("<html>", { status: 502 })),
    );
    expect(await source.fetch(week)).toMatchObject({
      ok: false,
      error: { code: "unavailable", message: "Google property did not answer (HTTP 502)" },
    });
  });
});
