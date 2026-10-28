import { describe, expect, it } from "vitest";
import { parseWebConfig } from "./config";

const KEY = Buffer.alloc(32, 7).toString("base64");

const base = {
  DATABASE_URL: "postgres://app:secret@localhost:5432/nuvantre",
  APP_URL: "http://localhost:3000",
  ANTHROPIC_API_KEY: "sk-ant-test-key",
  TOKEN_ENCRYPTION_KEY: KEY,
  DATAFORSEO_LOGIN: "founder@acme.dev",
  DATAFORSEO_PASSWORD: "dfs-password",
  ZERNIO_API_KEY: "sk_test_zernio",
  RESEND_API_KEY: "re_test_key",
  MAIL_FROM: "reports@mail.nuvantre.app",
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
        blogs: { webflowApiBaseUrl: null, wixApiBaseUrl: null },
        hardening: { trustProxy: false, rateLimitOverrides: {} },
        mail: { kind: "resend", apiKey: "re_test_key", from: "reports@mail.nuvantre.app" },
        monitoring: { sentry: null },
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
          zernio: { apiKey: "sk_test_zernio", baseUrl: null },
        },
        launch: {
          writer: { kind: "claude", apiKey: "sk-ant-test-key", model: "claude-opus-5-5" },
        },
        analytics: {
          google: null,
          analyst: { kind: "claude", apiKey: "sk-ant-test-key", model: "claude-opus-5-5" },
        },
        autopilot: {
          strategist: { kind: "claude", apiKey: "sk-ant-test-key", model: "claude-opus-5-5" },
          reviewer: { kind: "claude", apiKey: "sk-ant-test-key", model: "claude-opus-5-5" },
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
    expect(parseWebConfig({ ...local, APP_URL: "https://nuvantre.app/" })).toMatchObject({
      ok: true,
      value: { appUrl: "https://nuvantre.app" },
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
        "ANTHROPIC_API_KEY is required when BRIEF_DRAFTER, ARTICLE_WRITER, SOCIAL_WRITER, LAUNCH_WRITER, ANALYST, STRATEGIST or REVIEWER is claude",
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
        LAUNCH_WRITER: "template",
        ANALYST: "template",
        STRATEGIST: "template",
        REVIEWER: "template",
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
    ["WEBFLOW_API_BASE_URL", { WEBFLOW_API_BASE_URL: "http://127.0.0.1:4040/webflow/" }],
    ["WIX_API_BASE_URL", { WIX_API_BASE_URL: "http://127.0.0.1:4040/wix/" }],
    ["RATE_LIMIT_OVERRIDES", { RATE_LIMIT_OVERRIDES: "signup=1000" }],
  ])("refuses %s in production", (setting, override) => {
    expect(parseWebConfig({ ...stripe, ...override })).toEqual({
      ok: false,
      error: `${setting} is only allowed when APP_ENV is development or test`,
    });
  });
});

describe("parseWebConfig mail settings", () => {
  it("sends invitations and reports through Resend from the verified address", () => {
    expect(parseWebConfig(stripe)).toMatchObject({
      ok: true,
      value: {
        mail: { kind: "resend", apiKey: "re_test_key", from: "reports@mail.nuvantre.app" },
      },
    });
  });

  it("needs the Resend key and a sending address", () => {
    expect(parseWebConfig({ ...stripe, RESEND_API_KEY: undefined })).toEqual({
      ok: false,
      error: "RESEND_API_KEY is required to send email",
    });
    expect(parseWebConfig({ ...stripe, MAIL_FROM: "nope" })).toEqual({
      ok: false,
      error: "MAIL_FROM must be an address on a domain verified in Resend",
    });
  });

  it("allows the log mailer and a local Resend stand-in in development and test only", () => {
    expect(parseWebConfig({ ...local, MAILER: "log" })).toMatchObject({
      ok: true,
      value: { mail: { kind: "log" } },
    });
    expect(parseWebConfig({ ...local, RESEND_BASE_URL: "http://127.0.0.1:4011" })).toMatchObject({
      ok: true,
      value: { mail: { baseUrl: "http://127.0.0.1:4011" } },
    });
    expect(parseWebConfig({ ...stripe, MAILER: "log" })).toEqual({
      ok: false,
      error: "MAILER=log and RESEND_BASE_URL are for development and test only",
    });
  });
});

describe("parseWebConfig hardening and monitoring", () => {
  it("reads the client address from the proxy only when TRUST_PROXY is set", () => {
    expect(parseWebConfig({ ...stripe, TRUST_PROXY: "true" })).toMatchObject({
      ok: true,
      value: { hardening: { trustProxy: true } },
    });
  });

  it("lets development and test raise named rate limits", () => {
    expect(
      parseWebConfig({ ...local, RATE_LIMIT_OVERRIDES: "signup=1000, draft=500" }),
    ).toMatchObject({
      ok: true,
      value: { hardening: { rateLimitOverrides: { signup: 1000, draft: 500 } } },
    });
    for (const bad of ["signin=5", "signup=lots", "signup"]) {
      expect(parseWebConfig({ ...local, RATE_LIMIT_OVERRIDES: bad })).toEqual({
        ok: false,
        error: "RATE_LIMIT_OVERRIDES must look like signup=1000,draft=500",
      });
    }
  });

  it("reports errors to Sentry when SENTRY_DSN is set", () => {
    expect(
      parseWebConfig({
        ...stripe,
        SENTRY_DSN: "https://key@o1.ingest.sentry.io/2",
        APP_VERSION: "1.2.3",
      }),
    ).toMatchObject({
      ok: true,
      value: {
        monitoring: {
          sentry: {
            dsn: "https://key@o1.ingest.sentry.io/2",
            environment: "production",
            release: "1.2.3",
          },
        },
      },
    });
    expect(parseWebConfig({ ...stripe, SENTRY_DSN: "nope" }).ok).toBe(false);
  });
});

describe("parseWebConfig blog settings", () => {
  it("can point Webflow and Wix at local stand-ins, for tests", () => {
    expect(
      parseWebConfig({
        ...local,
        WEBFLOW_API_BASE_URL: "http://127.0.0.1:4040/webflow/",
        WIX_API_BASE_URL: "http://127.0.0.1:4040/wix/",
      }),
    ).toMatchObject({
      ok: true,
      value: {
        blogs: {
          webflowApiBaseUrl: "http://127.0.0.1:4040/webflow/",
          wixApiBaseUrl: "http://127.0.0.1:4040/wix/",
        },
      },
    });
    expect(parseWebConfig({ ...local, WIX_API_BASE_URL: "stub" }).ok).toBe(false);
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
  it("needs ZERNIO_API_KEY", () => {
    expect(parseWebConfig({ ...stripe, ZERNIO_API_KEY: undefined })).toEqual({
      ok: false,
      error: "ZERNIO_API_KEY is required",
    });
  });

  it("can point Zernio at another base URL, for tests", () => {
    expect(
      parseWebConfig({ ...local, ZERNIO_BASE_URL: "http://127.0.0.1:4020/api" }),
    ).toMatchObject({
      ok: true,
      value: { social: { zernio: { baseUrl: "http://127.0.0.1:4020/api" } } },
    });
    expect(parseWebConfig({ ...local, ZERNIO_BASE_URL: "stub" }).ok).toBe(false);
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
        "ANTHROPIC_API_KEY is required when BRIEF_DRAFTER, ARTICLE_WRITER, SOCIAL_WRITER, LAUNCH_WRITER, ANALYST, STRATEGIST or REVIEWER is claude",
    });
  });
});

describe("parseWebConfig launch settings", () => {
  it("drafts launch kits with the offline template writer only in development and test", () => {
    expect(parseWebConfig({ ...local, LAUNCH_WRITER: "template" })).toMatchObject({
      ok: true,
      value: { launch: { writer: { kind: "template" } } },
    });
    expect(parseWebConfig({ ...stripe, LAUNCH_WRITER: "template" })).toEqual({
      ok: false,
      error: "LAUNCH_WRITER=template is only allowed when APP_ENV is development or test",
    });
    expect(parseWebConfig({ ...local, LAUNCH_WRITER: "gpt" }).ok).toBe(false);
  });
});

describe("parseWebConfig analytics settings", () => {
  const google = {
    GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "gsec",
  };

  it("connects Google when both OAuth client settings are present", () => {
    expect(parseWebConfig({ ...local, ...google })).toMatchObject({
      ok: true,
      value: {
        analytics: {
          google: { clientId: google.GOOGLE_CLIENT_ID, clientSecret: "gsec", baseUrl: null },
        },
      },
    });
    expect(parseWebConfig({ ...local, GOOGLE_CLIENT_ID: "only-id" })).toEqual({
      ok: false,
      error: "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither",
    });
  });

  it("allows the template analyst and a Google stand-in only in development and test", () => {
    expect(
      parseWebConfig({
        ...local,
        ...google,
        ANALYST: "template",
        GOOGLE_API_BASE_URL: "http://127.0.0.1:4030",
      }),
    ).toMatchObject({
      ok: true,
      value: {
        analytics: { google: { baseUrl: "http://127.0.0.1:4030" }, analyst: { kind: "template" } },
      },
    });
    expect(parseWebConfig({ ...stripe, ANALYST: "template" })).toEqual({
      ok: false,
      error: "ANALYST=template is only allowed when APP_ENV is development or test",
    });
    expect(
      parseWebConfig({ ...stripe, ...google, GOOGLE_API_BASE_URL: "http://127.0.0.1:4030" }),
    ).toEqual({
      ok: false,
      error: "GOOGLE_API_BASE_URL is only allowed when APP_ENV is development or test",
    });
  });
});

describe("parseWebConfig autopilot settings", () => {
  it("plans and reviews with the offline templates only in development and test", () => {
    expect(
      parseWebConfig({ ...local, STRATEGIST: "template", REVIEWER: "template" }),
    ).toMatchObject({
      ok: true,
      value: { autopilot: { strategist: { kind: "template" }, reviewer: { kind: "template" } } },
    });
    for (const setting of ["STRATEGIST", "REVIEWER"]) {
      expect(parseWebConfig({ ...stripe, [setting]: "template" })).toEqual({
        ok: false,
        error: `${setting}=template is only allowed when APP_ENV is development or test`,
      });
    }
  });
});
