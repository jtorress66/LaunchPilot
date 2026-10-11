import { describe, expect, it } from "vitest";
import { parseDatabaseConfig, parseStripeSetupConfig } from "./config";

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
