import { parseEmail } from "../account/email";
import { andThen, err, map, ok, type Result } from "../result";
import { domainError, type DomainError } from "../shared/errors";
import type { AnalyticsConnectionId, ProductId } from "../shared/ids";
import { nonEmptyText } from "../shared/text";
import { parseHttpUrl } from "../shared/url";

export const analyticsProviders = ["google", "plausible"] as const;
export type AnalyticsProvider = (typeof analyticsProviders)[number];

interface ConnectionBase {
  readonly id: AnalyticsConnectionId;
  readonly productId: ProductId;
  /** Encrypted by the TokenCipher port; the plaintext is never stored. */
  readonly encryptedSecret: string;
  readonly connectedAt: Date;
}

/** One Google sign-in covering Search Console and GA4. The secret is the refresh token. */
export interface GoogleConnection extends ConnectionBase {
  readonly provider: "google";
  readonly accountEmail: string;
  /** `sc-domain:acme.dev` or a URL-prefix property such as `https://www.acme.dev/`. */
  readonly searchConsoleSite: string | null;
  /** The numeric GA4 property id. */
  readonly ga4PropertyId: string | null;
}

/** A Plausible site, cloud or self-hosted. The secret is the Stats API key. */
export interface PlausibleConnection extends ConnectionBase {
  readonly provider: "plausible";
  readonly siteId: string;
  readonly baseUrl: string;
}

export type AnalyticsConnection = GoogleConnection | PlausibleConnection;

interface NewConnection {
  readonly id: AnalyticsConnectionId;
  readonly productId: ProductId;
  readonly encryptedSecret: string;
  readonly now: Date;
}

const secretOf = (value: string) => nonEmptyText(value, { field: "Secret", max: 10_000 });

export const createGoogleConnection = (
  input: NewConnection & { readonly accountEmail: string },
): Result<GoogleConnection, DomainError> =>
  andThen(parseEmail(input.accountEmail), (accountEmail) =>
    map(secretOf(input.encryptedSecret), (encryptedSecret) => ({
      id: input.id,
      productId: input.productId,
      provider: "google" as const,
      accountEmail,
      encryptedSecret,
      searchConsoleSite: null,
      ga4PropertyId: null,
      connectedAt: input.now,
    })),
  );

const SC_DOMAIN = /^sc-domain:[a-z0-9.-]+\.[a-z]{2,}$/i;
const GA4_PROPERTY = /^\d{1,20}$/;

const parseSearchConsoleSite = (site: string | null): Result<string | null, DomainError> => {
  if (site === null) return ok(null);
  if (SC_DOMAIN.test(site)) return ok(site);
  if (site.startsWith("sc-domain:")) {
    return err(domainError("invalid_url", `"${site}" is not a Search Console domain property`));
  }
  return parseHttpUrl(site);
};

const parseGa4Property = (property: string | null): Result<string | null, DomainError> =>
  property === null || GA4_PROPERTY.test(property)
    ? ok(property)
    : err(domainError("invalid_text", `"${property}" is not a numeric GA4 property id`));

/** Which Search Console and GA4 properties report for this product; either may be empty. */
export const chooseGoogleProperties = (
  connection: GoogleConnection,
  choice: { readonly searchConsoleSite: string | null; readonly ga4PropertyId: string | null },
): Result<GoogleConnection, DomainError> =>
  andThen(parseSearchConsoleSite(choice.searchConsoleSite), (searchConsoleSite) =>
    map(parseGa4Property(choice.ga4PropertyId), (ga4PropertyId) => ({
      ...connection,
      searchConsoleSite,
      ga4PropertyId,
    })),
  );

const SITE_ID = /^[a-z0-9.-]+$/i;

const parseSiteId = (value: string): Result<string, DomainError> =>
  andThen(nonEmptyText(value, { field: "Site", max: 253 }), (site) =>
    SITE_ID.test(site)
      ? ok(site)
      : err(domainError("invalid_text", "Site must be the domain Plausible shows, e.g. acme.dev")),
  );

export const createPlausibleConnection = (
  input: NewConnection & { readonly siteId: string; readonly baseUrl: string },
): Result<PlausibleConnection, DomainError> =>
  andThen(parseSiteId(input.siteId), (siteId) =>
    andThen(parseHttpUrl(input.baseUrl), (baseUrl) =>
      map(secretOf(input.encryptedSecret), (encryptedSecret) => ({
        id: input.id,
        productId: input.productId,
        provider: "plausible" as const,
        siteId,
        baseUrl,
        encryptedSecret,
        connectedAt: input.now,
      })),
    ),
  );
