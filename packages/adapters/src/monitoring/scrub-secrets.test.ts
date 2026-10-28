import { describe, expect, it } from "vitest";
import { scrubSecrets } from "./scrub-secrets";

describe("scrubSecrets", () => {
  it.each([
    ["a bearer token", "Authorization: Bearer abc.def-123", "Authorization: Bearer [redacted]"],
    [
      "a Ghost admin token",
      "Authorization: Ghost eyJ0.eyJ1.sig",
      "Authorization: Ghost [redacted]",
    ],
    ["a Stripe secret key", "key sk_live_51HxYzAbC failed", "key [redacted] failed"],
    ["a Stripe webhook secret", "whsec_9f8e7d6c5b", "[redacted]"],
    ["a Shopify token", "token shpat_0123abcd", "token [redacted]"],
    ["an Anthropic key", "sk-ant-api03-AbC_dEf", "[redacted]"],
    ["a password field", "password=hunter2&user=a", "password=[redacted]&user=a"],
    [
      "a connection string's password",
      "postgres://app:s3cret@db.internal:5432/nuvantre",
      "postgres://app:[redacted]@db.internal:5432/nuvantre",
    ],
    [
      "secret query parameters",
      "https://x.io/cb?code=abc123&state=xyz&page=2",
      "https://x.io/cb?code=[redacted]&state=[redacted]&page=2",
    ],
  ])("removes %s", (_case, text, scrubbed) => {
    expect(scrubSecrets(text)).toBe(scrubbed);
  });

  it("leaves ordinary text alone", () => {
    const text = "Publishing failed: WordPress rejected the post (HTTP 400)";
    expect(scrubSecrets(text)).toBe(text);
  });
});
