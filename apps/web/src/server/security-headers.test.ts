import { describe, expect, it } from "vitest";
import { buildSecurityHeaders } from "./security-headers";

const directives = (csp: string | undefined) =>
  Object.fromEntries(
    (csp ?? "").split(";").map((d) => {
      const [name = "", ...values] = d.trim().split(/\s+/);
      return [name, values];
    }),
  );

describe("buildSecurityHeaders", () => {
  it("allows scripts only with this response's nonce, and nothing from other sites", () => {
    const csp = directives(
      buildSecurityHeaders("abc123", { https: true, development: false })[
        "content-security-policy"
      ],
    );
    expect(csp).toMatchObject({
      "default-src": ["'self'"],
      "script-src": ["'self'", "'nonce-abc123'", "'strict-dynamic'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "frame-ancestors": ["'none'"],
      "img-src": ["'self'", "data:", "https:"],
      "connect-src": ["'self'"],
    });
    expect(csp["script-src"]).not.toContain("'unsafe-eval'");
    expect(csp["script-src"]).not.toContain("'unsafe-inline'");
  });

  it("lets forms post only to the app, and on to Stripe Checkout", () => {
    const csp = directives(
      buildSecurityHeaders("n", { https: true, development: false })["content-security-policy"],
    );
    expect(csp["form-action"]).toEqual(["'self'", "https://checkout.stripe.com"]);
  });

  it("asks browsers to stay on HTTPS only when served over HTTPS", () => {
    expect(
      buildSecurityHeaders("n", { https: true, development: false })["strict-transport-security"],
    ).toBe("max-age=63072000; includeSubDomains");
    expect(buildSecurityHeaders("n", { https: false, development: false })).not.toHaveProperty(
      "strict-transport-security",
    );
  });

  it("allows eval only for the development server's hot reload", () => {
    const csp = directives(
      buildSecurityHeaders("n", { https: false, development: true })["content-security-policy"],
    );
    expect(csp["script-src"]).toContain("'unsafe-eval'");
  });
});
