import { describe, expect, it } from "vitest";
import {
  parseDatabaseConfig,
  parsePublisherConfig,
  parseReportsConfig,
  parseStripeSetupConfig,
} from "./config";

describe("parseDatabaseConfig", () => {
  it.each([
    "postgres://app:secret@localhost:5432/launchpilot",
    "postgresql://db.internal/launchpilot",
  ])("accepts %s", (url) => {
    expect(parseDatabaseConfig({ DATABASE_URL: url })).toEqual({
      ok: true,
      value: { connectionString: url },
    });
  });

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
    DATABASE_URL: "postgres://localhost/launchpilot",
    TOKEN_ENCRYPTION_KEY: KEY,
    ZERNIO_API_KEY: "sk_test_zernio",
  };

  it("reads what the publish job needs", () => {
    expect(parsePublisherConfig(env)).toEqual({
      ok: true,
      value: {
        connectionString: "postgres://localhost/launchpilot",
        tokenEncryptionKey: KEY,
        allowPrivateNetwork: false,
        intervalMs: 60_000,
        zernio: { apiKey: "sk_test_zernio", baseUrl: null },
      },
    });
  });

  it("accepts a Zernio base URL and an interval", () => {
    const result = parsePublisherConfig({
      ...env,
      ZERNIO_BASE_URL: "http://127.0.0.1:4020/api",
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
      },
    });
  });

  it.each([
    [{ ZERNIO_API_KEY: undefined }, "ZERNIO_API_KEY is required"],
    [{ TOKEN_ENCRYPTION_KEY: "short" }, "TOKEN_ENCRYPTION_KEY must be 32 random bytes"],
    [{ ZERNIO_BASE_URL: "stub" }, "ZERNIO_BASE_URL must be an absolute URL"],
    [{ ALLOW_PRIVATE_NETWORK: "true" }, "ALLOW_PRIVATE_NETWORK is only allowed"],
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
