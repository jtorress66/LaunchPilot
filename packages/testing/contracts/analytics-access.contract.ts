import { aGoogleConnection } from "../src/fixtures/analytics";
import { chooseGoogleProperties } from "@launchpilot/domain";
import type {
  AnalyticsPropertyLister,
  GoogleAuthorizer,
  PlausibleCredentials,
  PlausibleSiteVerifier,
} from "@launchpilot/ports";
import { describe, expect, it } from "vitest";

type Make<H> = () => H | Promise<H>;

export interface GoogleAuthorizerHarness {
  readonly authorizer: GoogleAuthorizer;
  /** A code the harness's Google accepts once. */
  readonly validCode: string;
}

const redirectUrl = "https://app.launchpilot.test/api/google/callback";

export function describeGoogleAuthorizerContract(
  name: string,
  make: Make<GoogleAuthorizerHarness>,
): void {
  describe(`GoogleAuthorizer contract: ${name}`, () => {
    it("builds a consent URL that asks for read-only, offline access and carries the state", async () => {
      const { authorizer } = await make();
      const url = new URL(authorizer.authorizationUrl({ state: "st_123", redirectUrl }));
      expect(url.protocol).toMatch(/^https?:$/);
      expect(url.searchParams.get("state")).toBe("st_123");
      expect(url.searchParams.get("redirect_uri")).toBe(redirectUrl);
      expect(url.searchParams.get("access_type")).toBe("offline");
      const scopes = url.searchParams.get("scope")?.split(" ") ?? [];
      expect(scopes).toContain("https://www.googleapis.com/auth/webmasters.readonly");
      expect(scopes).toContain("https://www.googleapis.com/auth/analytics.readonly");
      expect(scopes.every((s) => !/\.(manage|edit)|webmasters$|analytics$/.test(s))).toBe(true);
    });

    it("exchanges a valid code for a refresh token and the account's email", async () => {
      const { authorizer, validCode } = await make();
      const result = await authorizer.exchangeCode({ code: validCode, redirectUrl });
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.refreshToken).not.toBe("");
      expect(result.value.accountEmail).toMatch(/@/);
    });

    it("refuses an unknown code as invalid_grant without echoing it", async () => {
      const { authorizer } = await make();
      const result = await authorizer.exchangeCode({ code: "bogus-code-9876", redirectUrl });
      expect(result).toMatchObject({ ok: false, error: { code: "invalid_grant" } });
      expect(result.ok ? "" : result.error.message).not.toContain("bogus-code-9876");
    });
  });
}

export interface AnalyticsPropertyListerHarness {
  readonly lister: AnalyticsPropertyLister;
  readonly validToken: string;
}

export function describeAnalyticsPropertyListerContract(
  name: string,
  make: Make<AnalyticsPropertyListerHarness>,
): void {
  describe(`AnalyticsPropertyLister contract: ${name}`, () => {
    it("lists properties a Google connection can choose", async () => {
      const { lister, validToken } = await make();
      const result = await lister.list(validToken);
      if (!result.ok) throw new Error(result.error.message);
      const { searchConsoleSites, ga4Properties } = result.value;
      expect(searchConsoleSites.length + ga4Properties.length).toBeGreaterThan(0);
      for (const site of searchConsoleSites) {
        const choice = { searchConsoleSite: site.siteUrl, ga4PropertyId: null };
        expect(chooseGoogleProperties(aGoogleConnection(), choice).ok).toBe(true);
      }
      for (const property of ga4Properties) {
        const choice = { searchConsoleSite: null, ga4PropertyId: property.id };
        expect(chooseGoogleProperties(aGoogleConnection(), choice).ok).toBe(true);
        expect(property.name.trim()).not.toBe("");
      }
    });

    it("refuses a revoked token as invalid_credentials", async () => {
      const { lister } = await make();
      expect(await lister.list("revoked-token")).toMatchObject({
        ok: false,
        error: { code: "invalid_credentials" },
      });
    });
  });
}

export interface PlausibleSiteVerifierHarness {
  readonly verifier: PlausibleSiteVerifier;
  readonly valid: PlausibleCredentials;
}

export function describePlausibleSiteVerifierContract(
  name: string,
  make: Make<PlausibleSiteVerifierHarness>,
): void {
  describe(`PlausibleSiteVerifier contract: ${name}`, () => {
    it("accepts a working site and key", async () => {
      const { verifier, valid } = await make();
      expect(await verifier.verify(valid)).toEqual({ ok: true, value: undefined });
    });

    it("refuses a wrong key as invalid_credentials, without echoing it", async () => {
      const { verifier, valid } = await make();
      const result = await verifier.verify({ ...valid, apiKey: "wrong-key-5678" });
      expect(result).toMatchObject({ ok: false, error: { code: "invalid_credentials" } });
      expect(result.ok ? "" : result.error.message).not.toContain("wrong-key-5678");
    });

    it("refuses a site the key cannot read as site_not_found", async () => {
      const { verifier, valid } = await make();
      expect(await verifier.verify({ ...valid, siteId: "unknown.example" })).toMatchObject({
        ok: false,
        error: { code: "site_not_found" },
      });
    });
  });
}
