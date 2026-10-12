import { describe, expect, it } from "vitest";
import { parseWebConfig } from "./config";

const base = {
  DATABASE_URL: "postgres://app:secret@localhost:5432/launchpilot",
  APP_URL: "http://localhost:3000",
  ANTHROPIC_API_KEY: "sk-ant-test-key",
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
  it("accepts local billing in development", () => {
    expect(parseWebConfig(local)).toEqual({
      ok: true,
      value: {
        databaseUrl: base.DATABASE_URL,
        appUrl: "http://localhost:3000",
        billing: { provider: "local", secret: "a".repeat(32) },
        brief: {
          drafter: { kind: "claude", apiKey: "sk-ant-test-key", model: "claude-opus-5-5" },
          allowPrivateNetwork: false,
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
  ])("refuses %s", (_case, env) => {
    expect(parseWebConfig(env).ok).toBe(false);
  });
});

describe("parseWebConfig brief settings", () => {
  it("drafts with Claude by default and lets ANTHROPIC_MODEL choose the model", () => {
    expect(parseWebConfig({ ...stripe, ANTHROPIC_MODEL: "claude-sonnet-5-5" })).toMatchObject({
      ok: true,
      value: {
        brief: {
          drafter: { kind: "claude", apiKey: "sk-ant-test-key", model: "claude-sonnet-5-5" },
        },
      },
    });
  });

  it("needs ANTHROPIC_API_KEY to draft with Claude", () => {
    expect(parseWebConfig({ ...stripe, ANTHROPIC_API_KEY: undefined })).toEqual({
      ok: false,
      error: "ANTHROPIC_API_KEY is required when BRIEF_DRAFTER is claude",
    });
  });

  it("allows the offline extractive drafter and private-network crawling in development", () => {
    expect(
      parseWebConfig({
        ...local,
        ANTHROPIC_API_KEY: undefined,
        BRIEF_DRAFTER: "extractive",
        CRAWLER_ALLOW_PRIVATE_NETWORK: "true",
      }),
    ).toMatchObject({
      ok: true,
      value: { brief: { drafter: { kind: "extractive" }, allowPrivateNetwork: true } },
    });
  });

  it("refuses the extractive drafter in production so the AI is never skipped silently", () => {
    expect(parseWebConfig({ ...stripe, BRIEF_DRAFTER: "extractive" })).toEqual({
      ok: false,
      error: "BRIEF_DRAFTER=extractive is only allowed when APP_ENV is development or test",
    });
  });

  it("refuses private-network crawling in production", () => {
    expect(parseWebConfig({ ...stripe, CRAWLER_ALLOW_PRIVATE_NETWORK: "true" })).toEqual({
      ok: false,
      error: "CRAWLER_ALLOW_PRIVATE_NETWORK is only allowed when APP_ENV is development or test",
    });
  });
});
