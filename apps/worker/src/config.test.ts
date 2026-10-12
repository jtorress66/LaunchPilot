import { describe, expect, it } from "vitest";
import { parseDatabaseConfig, parsePublisherConfig, parseStripeSetupConfig } from "./config";

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
    AYRSHARE_API_KEY: "ayr-key",
    AYRSHARE_DOMAIN: "launchpilot",
    AYRSHARE_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\\nabc\\n-----END RSA PRIVATE KEY-----",
  };

  it("reads what the publish job needs, turning escaped newlines in the private key into real ones", () => {
    expect(parsePublisherConfig(env)).toEqual({
      ok: true,
      value: {
        connectionString: "postgres://localhost/launchpilot",
        tokenEncryptionKey: KEY,
        allowPrivateNetwork: false,
        intervalMs: 60_000,
        ayrshare: {
          apiKey: "ayr-key",
          domain: "launchpilot",
          privateKey: "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----",
          baseUrl: null,
          xCredentials: null,
        },
      },
    });
  });

  it("accepts X developer app keys, a base URL and an interval", () => {
    const result = parsePublisherConfig({
      ...env,
      AYRSHARE_BASE_URL: "http://127.0.0.1:4020",
      AYRSHARE_X_API_KEY: "x-key",
      AYRSHARE_X_API_SECRET: "x-secret",
      PUBLISH_INTERVAL_MS: "30000",
      APP_ENV: "test",
      ALLOW_PRIVATE_NETWORK: "true",
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        intervalMs: 30_000,
        allowPrivateNetwork: true,
        ayrshare: {
          baseUrl: "http://127.0.0.1:4020",
          xCredentials: { apiKey: "x-key", apiSecret: "x-secret" },
        },
      },
    });
  });

  it.each([
    [{ AYRSHARE_API_KEY: undefined }, "AYRSHARE_API_KEY is required"],
    [{ TOKEN_ENCRYPTION_KEY: "short" }, "TOKEN_ENCRYPTION_KEY must be 32 random bytes"],
    [{ AYRSHARE_X_API_KEY: "x-key" }, "AYRSHARE_X_API_KEY and AYRSHARE_X_API_SECRET go together"],
    [{ ALLOW_PRIVATE_NETWORK: "true" }, "ALLOW_PRIVATE_NETWORK is only allowed"],
    [{ PUBLISH_INTERVAL_MS: "500" }, "PUBLISH_INTERVAL_MS must be at least 5000"],
  ])("refuses %o", (override, message) => {
    const result = parsePublisherConfig({ ...env, ...override });
    expect(result.ok ? undefined : result.error).toContain(message);
  });
});
