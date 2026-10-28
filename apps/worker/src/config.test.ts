import { describe, expect, it } from "vitest";
import {
  parseDatabaseConfig,
  parseLoopConfig,
  parseBlogSmokeConfig,
  parseMailConfig,
  parseMonitoringConfig,
  parsePublisherConfig,
  parseReportsConfig,
  parseStripeSetupConfig,
} from "./config";

describe("parseDatabaseConfig", () => {
  it.each(["postgres://app:secret@localhost:5432/nuvantre", "postgresql://db.internal/nuvantre"])(
    "accepts %s",
    (url) => {
      expect(parseDatabaseConfig({ DATABASE_URL: url })).toEqual({
        ok: true,
        value: { connectionString: url },
      });
    },
  );

  it("explains that DATABASE_URL is required when it is missing", () => {
    expect(parseDatabaseConfig({})).toEqual({
      ok: false,
      error: "DATABASE_URL is required",
    });
  });

  it.each(["mysql://localhost/db", "not a url", ""])("rejects %j as not a Postgres URL", (url) => {
    expect(parseDatabaseConfig({ DATABASE_URL: url })).toEqual({
      ok: false,
      error: "DATABASE_URL must be a postgres:// or postgresql:// URL",
    });
  });
});

describe("parseStripeSetupConfig", () => {
  it("accepts a test-mode secret key", () => {
    expect(parseStripeSetupConfig({ STRIPE_SECRET_KEY: "sk_test_abc" }, [])).toEqual({
      ok: true,
      value: { secretKey: "sk_test_abc" },
    });
  });

  it("refuses a live key unless --live is passed", () => {
    expect(parseStripeSetupConfig({ STRIPE_SECRET_KEY: "sk_live_abc" }, [])).toEqual({
      ok: false,
      error: "Refusing to use a live Stripe key. Pass --live if you really mean it.",
    });
    expect(parseStripeSetupConfig({ STRIPE_SECRET_KEY: "sk_live_abc" }, ["--live"]).ok).toBe(true);
  });

  it("explains a missing key", () => {
    expect(parseStripeSetupConfig({}, [])).toEqual({
      ok: false,
      error: "STRIPE_SECRET_KEY is required",
    });
  });
});

describe("parsePublisherConfig", () => {
  const KEY = Buffer.alloc(32, 7).toString("base64");
  const env = {
    DATABASE_URL: "postgres://localhost/nuvantre",
    TOKEN_ENCRYPTION_KEY: KEY,
    ZERNIO_API_KEY: "sk_test_zernio",
  };

  it("reads what the publish job needs", () => {
    expect(parsePublisherConfig(env)).toEqual({
      ok: true,
      value: {
        connectionString: "postgres://localhost/nuvantre",
        tokenEncryptionKey: KEY,
        allowPrivateNetwork: false,
        intervalMs: 60_000,
        zernio: { apiKey: "sk_test_zernio", baseUrl: null },
        blogs: { webflowApiBaseUrl: null, wixApiBaseUrl: null },
      },
    });
  });

  it("accepts a Zernio base URL and an interval", () => {
    const result = parsePublisherConfig({
      ...env,
      ZERNIO_BASE_URL: "http://127.0.0.1:4020/api",
      WEBFLOW_API_BASE_URL: "http://127.0.0.1:4040/webflow/",
      WIX_API_BASE_URL: "http://127.0.0.1:4040/wix/",
      PUBLISH_INTERVAL_MS: "30000",
      APP_ENV: "test",
      ALLOW_PRIVATE_NETWORK: "true",
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        intervalMs: 30_000,
        allowPrivateNetwork: true,
        zernio: { baseUrl: "http://127.0.0.1:4020/api" },
        blogs: {
          webflowApiBaseUrl: "http://127.0.0.1:4040/webflow/",
          wixApiBaseUrl: "http://127.0.0.1:4040/wix/",
        },
      },
    });
  });

  it.each([
    [{ ZERNIO_API_KEY: undefined }, "ZERNIO_API_KEY is required"],
    [{ TOKEN_ENCRYPTION_KEY: "short" }, "TOKEN_ENCRYPTION_KEY must be 32 random bytes"],
    [{ ZERNIO_BASE_URL: "stub" }, "ZERNIO_BASE_URL must be an absolute URL"],
    [{ ALLOW_PRIVATE_NETWORK: "true" }, "ALLOW_PRIVATE_NETWORK is only allowed"],
    [{ WEBFLOW_API_BASE_URL: "http://127.0.0.1:1/" }, "WEBFLOW_API_BASE_URL is only allowed"],
    [{ WIX_API_BASE_URL: "http://127.0.0.1:1/" }, "WIX_API_BASE_URL is only allowed"],
    [{ APP_ENV: "test", WIX_API_BASE_URL: "stub" }, "WIX_API_BASE_URL must be an absolute URL"],
    [{ PUBLISH_INTERVAL_MS: "500" }, "PUBLISH_INTERVAL_MS must be at least 5000"],
  ])("refuses %o", (override, message) => {
    const result = parsePublisherConfig({ ...env, ...override });
    expect(result.ok ? undefined : result.error).toContain(message);
  });
});

describe("parseReportsConfig", () => {
  const google = {
    GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "gsec",
  };
  const claude = { ANTHROPIC_API_KEY: "sk-ant-test" };

  it("reads Google, the Claude analyst and an hourly interval by default", () => {
    expect(parseReportsConfig({ ...google, ...claude })).toEqual({
      ok: true,
      value: {
        intervalMs: 3_600_000,
        google: {
          clientId: "id.apps.googleusercontent.com",
          clientSecret: "gsec",
          baseUrl: null,
        },
        analyst: { kind: "claude", apiKey: "sk-ant-test", model: null },
      },
    });
  });

  it("runs without Google, and with the template analyst and a stub in development", () => {
    expect(parseReportsConfig({ APP_ENV: "development", ANALYST: "template" })).toMatchObject({
      ok: true,
      value: { google: null, analyst: { kind: "template" } },
    });
    expect(
      parseReportsConfig({
        ...google,
        APP_ENV: "test",
        ANALYST: "template",
        GOOGLE_API_BASE_URL: "http://127.0.0.1:4030",
        REPORT_INTERVAL_MS: "60000",
      }),
    ).toMatchObject({
      ok: true,
      value: { intervalMs: 60_000, google: { baseUrl: "http://127.0.0.1:4030" } },
    });
  });

  it.each([
    [{ GOOGLE_CLIENT_SECRET: undefined }, "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"],
    [{ ANTHROPIC_API_KEY: undefined }, "ANTHROPIC_API_KEY is required when ANALYST is claude"],
    [{ ANALYST: "template" }, "ANALYST=template is only allowed"],
    [{ GOOGLE_API_BASE_URL: "http://127.0.0.1:4030" }, "GOOGLE_API_BASE_URL is only allowed"],
    [{ REPORT_INTERVAL_MS: "1000" }, "REPORT_INTERVAL_MS must be at least 60000"],
  ])("refuses %o", (override, message) => {
    const result = parseReportsConfig({ ...google, ...claude, ...override });
    expect(result.ok ? "" : result.error).toContain(message);
  });
});

describe("parseLoopConfig", () => {
  const claude = { ANTHROPIC_API_KEY: "sk-ant-test" };
  const dataforseo = { DATAFORSEO_LOGIN: "me@acme.dev", DATAFORSEO_PASSWORD: "pw" };

  it("uses Claude for every agent and DataForSEO for keywords by default, hourly", () => {
    expect(parseLoopConfig({ ...claude, ...dataforseo })).toEqual({
      ok: true,
      value: {
        intervalMs: 3_600_000,
        claude: { apiKey: "sk-ant-test", model: null },
        agents: {
          strategist: "claude",
          reviewer: "claude",
          articleWriter: "claude",
          socialWriter: "claude",
        },
        keywords: { kind: "dataforseo", login: "me@acme.dev", password: "pw", baseUrl: null },
      },
    });
  });

  it("runs fully offline in development and test", () => {
    expect(
      parseLoopConfig({
        APP_ENV: "test",
        STRATEGIST: "template",
        REVIEWER: "template",
        ARTICLE_WRITER: "template",
        SOCIAL_WRITER: "template",
        KEYWORD_PROVIDER: "offline",
        LOOP_INTERVAL_MS: "60000",
      }),
    ).toEqual({
      ok: true,
      value: {
        intervalMs: 60_000,
        claude: null,
        agents: {
          strategist: "template",
          reviewer: "template",
          articleWriter: "template",
          socialWriter: "template",
        },
        keywords: { kind: "offline" },
      },
    });
  });

  it.each([
    [{ ANTHROPIC_API_KEY: undefined }, "ANTHROPIC_API_KEY is required when an agent uses Claude"],
    [{ REVIEWER: "template" }, "REVIEWER=template is only allowed"],
    [{ KEYWORD_PROVIDER: "offline" }, "KEYWORD_PROVIDER=offline is only allowed"],
    [{ DATAFORSEO_PASSWORD: undefined }, "DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are required"],
    [{ LOOP_INTERVAL_MS: "10" }, "LOOP_INTERVAL_MS must be at least 60000"],
  ])("refuses %o", (override, message) => {
    const result = parseLoopConfig({ ...claude, ...dataforseo, ...override });
    expect(result.ok ? "" : result.error).toContain(message);
  });
});

describe("parseBlogSmokeConfig", () => {
  const shopify = {
    SHOPIFY_STORE_URL: "https://acme.myshopify.com",
    SHOPIFY_ACCESS_TOKEN: "shpat_x",
  };
  const webflow = {
    WEBFLOW_SITE_URL: "https://www.acme.dev",
    WEBFLOW_COLLECTION_ID: "col_1",
    WEBFLOW_API_TOKEN: "wf_x",
  };
  const wix = { WIX_SITE_URL: "https://www.acme.dev", WIX_SITE_ID: "site_1", WIX_API_KEY: "IST.x" };

  it("checks only the platforms whose test account is configured", () => {
    expect(parseBlogSmokeConfig({ ...shopify, ...wix })).toEqual({
      ok: true,
      value: [
        {
          platform: "shopify",
          siteUrl: "https://acme.myshopify.com",
          settings: {},
          secret: "shpat_x",
        },
        {
          platform: "wix",
          siteUrl: "https://www.acme.dev",
          settings: { siteId: "site_1" },
          secret: "IST.x",
        },
      ],
    });
    expect(parseBlogSmokeConfig(webflow)).toMatchObject({
      ok: true,
      value: [{ platform: "webflow", settings: { collectionId: "col_1" }, secret: "wf_x" }],
    });
  });

  it("checks nothing when no test account is configured", () => {
    expect(parseBlogSmokeConfig({})).toEqual({ ok: true, value: [] });
  });

  it("names what is missing for a half-configured platform", () => {
    expect(parseBlogSmokeConfig({ WEBFLOW_API_TOKEN: "wf_x" })).toEqual({
      ok: false,
      error: "Webflow smoke check needs WEBFLOW_SITE_URL, WEBFLOW_COLLECTION_ID",
    });
  });
});

describe("parseMonitoringConfig", () => {
  it("reports to Sentry when SENTRY_DSN is set, tagged with the environment", () => {
    expect(
      parseMonitoringConfig({
        SENTRY_DSN: "https://key@o1.ingest.sentry.io/2",
        APP_ENV: "production",
        APP_VERSION: "1.2.3",
      }),
    ).toEqual({
      ok: true,
      value: {
        sentry: {
          dsn: "https://key@o1.ingest.sentry.io/2",
          environment: "production",
          release: "1.2.3",
        },
      },
    });
  });

  it("logs errors as JSON lines when SENTRY_DSN is not set", () => {
    expect(parseMonitoringConfig({})).toEqual({ ok: true, value: { sentry: null } });
  });

  it("refuses a DSN that is not a URL", () => {
    expect(parseMonitoringConfig({ SENTRY_DSN: "not a dsn" })).toEqual({
      ok: false,
      error: "SENTRY_DSN must be a Sentry DSN URL",
    });
  });
});

describe("parseMailConfig", () => {
  const resend = {
    RESEND_API_KEY: "re_live_key",
    MAIL_FROM: "reports@mail.nuvantre.app",
  };

  it("sends through Resend from the verified address by default", () => {
    expect(parseMailConfig(resend)).toEqual({
      ok: true,
      value: { kind: "resend", apiKey: "re_live_key", from: "reports@mail.nuvantre.app" },
    });
  });

  it("needs the Resend key and a sending address", () => {
    expect(parseMailConfig({ MAIL_FROM: resend.MAIL_FROM })).toEqual({
      ok: false,
      error: "RESEND_API_KEY is required to send email",
    });
    expect(parseMailConfig({ RESEND_API_KEY: "re_x", MAIL_FROM: "nope" })).toEqual({
      ok: false,
      error: "MAIL_FROM must be an address on a domain verified in Resend",
    });
  });

  it("allows a log-only mailer and a local Resend stand-in in development and test only", () => {
    expect(parseMailConfig({ MAILER: "log", APP_ENV: "development" })).toEqual({
      ok: true,
      value: { kind: "log" },
    });
    expect(
      parseMailConfig({ ...resend, APP_ENV: "test", RESEND_BASE_URL: "http://127.0.0.1:4011" }),
    ).toMatchObject({ ok: true, value: { baseUrl: "http://127.0.0.1:4011" } });
    expect(parseMailConfig({ MAILER: "log" })).toEqual({
      ok: false,
      error: "MAILER=log and RESEND_BASE_URL are for development and test only",
    });
    expect(parseMailConfig({ ...resend, RESEND_BASE_URL: "http://127.0.0.1:4011" }).ok).toBe(false);
  });
});
