import { describe, expect, it } from "vitest";
import { parseWebConfig } from "./config";

const KEY = Buffer.alloc(32, 7).toString("base64");

const base = {
  DATABASE_URL: "postgres://app:secret@localhost:5432/launchpilot",
  APP_URL: "http://localhost:3000",
  ANTHROPIC_API_KEY: "sk-ant-test-key",
  TOKEN_ENCRYPTION_KEY: KEY,
  DATAFORSEO_LOGIN: "founder@acme.dev",
  DATAFORSEO_PASSWORD: "dfs-password",
  AYRSHARE_API_KEY: "ayr-key",
  AYRSHARE_DOMAIN: "launchpilot",
  AYRSHARE_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\\nabc\\n-----END RSA PRIVATE KEY-----",
};
const local = {
  ...base,
  APP_ENV: "development",
  BILLING_PROVIDER: "local",
  LOCAL_BILLING_SECRET: "a".repeat(32),
};
const stripe = {
  ...base,
  BILLING_PROVIDER: "stripe",
  STRIPE_SECRET_KEY: "sk_test_123",
  STRIPE_WEBHOOK_SECRET: "whsec_123",
};

describe("parseWebConfig", () => {
  it("accepts local billing in development, with Claude and DataForSEO by default", () => {
    expect(parseWebConfig(local)).toEqual({
      ok: true,
      value: {
        databaseUrl: base.DATABASE_URL,
        appUrl: "http://localhost:3000",
        billing: { provider: "local", secret: "a".repeat(32) },
        allowPrivateNetwork: false,
        tokenEncryptionKey: KEY,
        brief: {
          drafter: { kind: "claude", apiKey: "sk-ant-test-key", model: "claude-opus-5-5" },
        },
        seo: {
          keywords: {
            kind: "dataforseo",
            login: "founder@acme.dev",
            password: "dfs-password",
            baseUrl: null,
          },
          writer: { kind: "claude", apiKey: "sk-ant-test-key", model: "claude-opus-5-5" },
        },
        social: {
          writer: { kind: "claude", apiKey: "sk-ant-test-key", model: "claude-opus-5-5" },
          ayrshare: {
            apiKey: "ayr-key",
            domain: "launchpilot",
            privateKey: "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----",
            baseUrl: null,
            xCredentials: null,
          },
        },
      },
    });
  });

  it("accepts Stripe billing with both keys", () => {
    expect(parseWebConfig(stripe)).toMatchObject({
      ok: true,
      value: {
        billing: { provider: "stripe", secretKey: "sk_test_123", webhookSecret: "whsec_123" },
      },
    });
  });

  it("drops a trailing slash from APP_URL", () => {
    expect(parseWebConfig({ ...local, APP_URL: "https://launchpilot.app/" })).toMatchObject({
      ok: true,
      value: { appUrl: "https://launchpilot.app" },
    });
  });

  it("refuses local billing unless APP_ENV says development or test", () => {
    expect(parseWebConfig({ ...local, APP_ENV: undefined })).toEqual({
      ok: false,
      error: "BILLING_PROVIDER=local is only allowed when APP_ENV is development or test",
    });
    expect(parseWebConfig({ ...local, APP_ENV: "production" }).ok).toBe(false);
  });

  it.each([
    ["a missing Stripe webhook secret", { ...stripe, STRIPE_WEBHOOK_SECRET: undefined }],
    ["a Stripe key in the wrong format", { ...stripe, STRIPE_SECRET_KEY: "pk_test_123" }],
    ["a short local billing secret", { ...local, LOCAL_BILLING_SECRET: "short" }],
    ["an unknown billing provider", { ...local, BILLING_PROVIDER: "paypal" }],
    ["a missing DATABASE_URL", { ...local, DATABASE_URL: undefined }],
    ["an invalid APP_URL", { ...local, APP_URL: "localhost" }],
    ["an unknown brief drafter", { ...local, BRIEF_DRAFTER: "gpt" }],
    ["a model that is not a Claude model", { ...local, ANTHROPIC_MODEL: "gpt-5" }],
    ["an unknown keyword provider", { ...local, KEYWORD_PROVIDER: "semrush" }],
    ["an unknown article writer", { ...local, ARTICLE_WRITER: "gpt" }],
    ["an invalid DataForSEO base URL", { ...local, DATAFORSEO_BASE_URL: "stub" }],
  ])("refuses %s", (_case, env) => {
    expect(parseWebConfig(env).ok).toBe(false);
  });
});

describe("parseWebConfig secrets at rest", () => {
  it.each([
    ["missing", undefined],
    ["too short", Buffer.alloc(16).toString("base64")],
    ["not base64 of 32 bytes", "not-a-key"],
  ])("refuses a TOKEN_ENCRYPTION_KEY that is %s", (_case, value) => {
    expect(parseWebConfig({ ...local, TOKEN_ENCRYPTION_KEY: value })).toEqual({
      ok: false,
      error:
        "TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)",
    });
  });
});

describe("parseWebConfig AI settings", () => {
  it("lets ANTHROPIC_MODEL choose the model for briefs and articles", () => {
    expect(parseWebConfig({ ...stripe, ANTHROPIC_MODEL: "claude-sonnet-5-5" })).toMatchObject({
      ok: true,
      value: {
        brief: { drafter: { model: "claude-sonnet-5-5" } },
        seo: { writer: { model: "claude-sonnet-5-5" } },
      },
    });
  });

  it("needs ANTHROPIC_API_KEY to draft briefs or articles with Claude", () => {
    expect(parseWebConfig({ ...stripe, ANTHROPIC_API_KEY: undefined })).toEqual({
      ok: false,
      error:
        "ANTHROPIC_API_KEY is required when BRIEF_DRAFTER, ARTICLE_WRITER or SOCIAL_WRITER is claude",
    });
  });

  it("works offline in development: extractive briefs, template articles, seed keywords, local sites", () => {
    expect(
      parseWebConfig({
        ...local,
        ANTHROPIC_API_KEY: undefined,
        DATAFORSEO_LOGIN: undefined,
        DATAFORSEO_PASSWORD: undefined,
        BRIEF_DRAFTER: "extractive",
        ARTICLE_WRITER: "template",
        KEYWORD_PROVIDER: "offline",
        SOCIAL_WRITER: "template",
        ALLOW_PRIVATE_NETWORK: "true",
      }),
    ).toMatchObject({
      ok: true,
      value: {
        allowPrivateNetwork: true,
        brief: { drafter: { kind: "extractive" } },
        seo: { keywords: { kind: "offline" }, writer: { kind: "template" } },
      },
    });
  });

  it.each([
    ["BRIEF_DRAFTER=extractive", { BRIEF_DRAFTER: "extractive" }],
    ["ARTICLE_WRITER=template", { ARTICLE_WRITER: "template" }],
    ["KEYWORD_PROVIDER=offline", { KEYWORD_PROVIDER: "offline" }],
    ["ALLOW_PRIVATE_NETWORK", { ALLOW_PRIVATE_NETWORK: "true" }],
  ])("refuses %s in production", (setting, override) => {
    expect(parseWebConfig({ ...stripe, ...override })).toEqual({
      ok: false,
      error: `${setting} is only allowed when APP_ENV is development or test`,
    });
  });
});

describe("parseWebConfig keyword settings", () => {
  it("needs DataForSEO credentials unless the offline provider is chosen", () => {
    expect(parseWebConfig({ ...stripe, DATAFORSEO_PASSWORD: undefined })).toEqual({
      ok: false,
      error:
        "DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are required when KEYWORD_PROVIDER is dataforseo",
    });
  });

  it("can point DataForSEO at another base URL, for tests", () => {
    expect(
      parseWebConfig({ ...local, DATAFORSEO_BASE_URL: "http://127.0.0.1:4010/dataforseo" }),
    ).toMatchObject({
      ok: true,
      value: { seo: { keywords: { baseUrl: "http://127.0.0.1:4010/dataforseo" } } },
    });
  });
});

describe("parseWebConfig social settings", () => {
  it("needs the Ayrshare API key, linking domain and private key", () => {
    for (const name of ["AYRSHARE_API_KEY", "AYRSHARE_DOMAIN", "AYRSHARE_PRIVATE_KEY"]) {
      expect(parseWebConfig({ ...stripe, [name]: undefined })).toEqual({
        ok: false,
        error: `${name} is required`,
      });
    }
  });

  it("takes X developer app keys in pairs, and a base URL for tests", () => {
    expect(
      parseWebConfig({
        ...local,
        AYRSHARE_X_API_KEY: "x-key",
        AYRSHARE_X_API_SECRET: "x-secret",
        AYRSHARE_BASE_URL: "http://127.0.0.1:4020",
      }),
    ).toMatchObject({
      ok: true,
      value: {
        social: {
          ayrshare: {
            baseUrl: "http://127.0.0.1:4020",
            xCredentials: { apiKey: "x-key", apiSecret: "x-secret" },
          },
        },
      },
    });
    expect(parseWebConfig({ ...local, AYRSHARE_X_API_KEY: "x-key" })).toEqual({
      ok: false,
      error: "AYRSHARE_X_API_KEY and AYRSHARE_X_API_SECRET go together: set both or neither",
    });
  });

  it("writes posts with the offline template writer only in development and test", () => {
    expect(parseWebConfig({ ...local, SOCIAL_WRITER: "template" })).toMatchObject({
      ok: true,
      value: { social: { writer: { kind: "template" } } },
    });
    expect(parseWebConfig({ ...stripe, SOCIAL_WRITER: "template" })).toEqual({
      ok: false,
      error: "SOCIAL_WRITER=template is only allowed when APP_ENV is development or test",
    });
  });

  it("needs ANTHROPIC_API_KEY to write posts with Claude", () => {
    expect(
      parseWebConfig({
        ...local,
        ANTHROPIC_API_KEY: undefined,
        BRIEF_DRAFTER: "extractive",
        ARTICLE_WRITER: "template",
      }),
    ).toEqual({
      ok: false,
      error:
        "ANTHROPIC_API_KEY is required when BRIEF_DRAFTER, ARTICLE_WRITER or SOCIAL_WRITER is claude",
    });
  });
});
