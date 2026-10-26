import { err, ok, type Result } from "@nuvantre/domain";
import type {
  AnalyticsProperties,
  AnalyticsPropertyLister,
  GoogleAuthError,
  GoogleAuthorizer,
  GoogleGrant,
  PlausibleCredentials,
  PlausibleSiteVerifier,
  PlausibleVerifyError,
  PropertyListError,
} from "@nuvantre/ports";

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];

/** Issues codes that exchange once for `fake-refresh-token`. */
export class FakeGoogleAuthorizer implements GoogleAuthorizer {
  static readonly refreshToken = "fake-refresh-token";
  private readonly codes = new Set<string>();
  private issued = 0;

  issueCode(): string {
    this.issued += 1;
    const code = `code_${String(this.issued)}`;
    this.codes.add(code);
    return code;
  }

  authorizationUrl({ state, redirectUrl }: { state: string; redirectUrl: string }): string {
    const url = new URL("https://accounts.google.test/o/oauth2/v2/auth");
    url.searchParams.set("state", state);
    url.searchParams.set("redirect_uri", redirectUrl);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("scope", SCOPES.join(" "));
    return url.toString();
  }

  exchangeCode({ code }: { code: string }): Promise<Result<GoogleGrant, GoogleAuthError>> {
    if (!this.codes.delete(code)) {
      return Promise.resolve(
        err({ code: "invalid_grant", message: "The sign-in code expired", retryable: false }),
      );
    }
    return Promise.resolve(
      ok({ refreshToken: FakeGoogleAuthorizer.refreshToken, accountEmail: "founder@acme.dev" }),
    );
  }
}

/** One Search Console domain property and one GA4 property for the fake refresh token. */
export class FakeAnalyticsPropertyLister implements AnalyticsPropertyLister {
  static readonly validToken = FakeGoogleAuthorizer.refreshToken;
  properties: AnalyticsProperties = {
    searchConsoleSites: [{ siteUrl: "sc-domain:acme.dev" }],
    ga4Properties: [{ id: "123456789", name: "acme.dev", account: "Acme" }],
  };

  list(refreshToken: string): Promise<Result<AnalyticsProperties, PropertyListError>> {
    if (refreshToken !== FakeAnalyticsPropertyLister.validToken) {
      return Promise.resolve(
        err({
          code: "invalid_credentials",
          message: "Google access was revoked",
          retryable: false,
        }),
      );
    }
    return Promise.resolve(ok(this.properties));
  }
}

/** Accepts `acme.dev` with the key `plausible-key`. */
export class FakePlausibleSiteVerifier implements PlausibleSiteVerifier {
  static readonly valid: PlausibleCredentials = {
    baseUrl: "https://plausible.io/",
    siteId: "acme.dev",
    apiKey: "plausible-key",
  };
  readonly verified: PlausibleCredentials[] = [];

  verify(credentials: PlausibleCredentials): Promise<Result<void, PlausibleVerifyError>> {
    const { valid } = FakePlausibleSiteVerifier;
    if (credentials.apiKey !== valid.apiKey) {
      return Promise.resolve(
        err({ code: "invalid_credentials", message: "API key rejected", retryable: false }),
      );
    }
    if (credentials.siteId !== valid.siteId) {
      return Promise.resolve(
        err({ code: "site_not_found", message: "Site not found", retryable: false }),
      );
    }
    this.verified.push(credentials);
    return Promise.resolve(ok(undefined));
  }
}
