import { describe, expect, it } from "vitest";
import { analyticsConnectionId, productId } from "../shared/ids";
import {
  chooseGoogleProperties,
  createGoogleConnection,
  createPlausibleConnection,
  type GoogleConnection,
} from "./analytics-connection";

const now = new Date("2026-10-20T09:00:00.000Z");
const base = { id: analyticsConnectionId("an_1"), productId: productId("prod_1"), now };

const google = (): GoogleConnection => {
  const result = createGoogleConnection({
    ...base,
    accountEmail: " Founder@Acme.dev ",
    encryptedSecret: "v1:iv:tag:ct",
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("createGoogleConnection", () => {
  it("starts with no properties chosen and a normalised email", () => {
    expect(google()).toEqual({
      id: "an_1",
      productId: "prod_1",
      provider: "google",
      accountEmail: "founder@acme.dev",
      encryptedSecret: "v1:iv:tag:ct",
      searchConsoleSite: null,
      ga4PropertyId: null,
      connectedAt: now,
    });
  });

  it("refuses a missing secret", () => {
    const result = createGoogleConnection({ ...base, accountEmail: "a@b.co", encryptedSecret: "" });
    expect(result.ok ? undefined : result.error.code).toBe("invalid_text");
  });
});

describe("chooseGoogleProperties", () => {
  it.each([
    ["a domain property", "sc-domain:acme.dev", "123456789"],
    ["a URL-prefix property", "https://www.acme.dev/", null],
    ["only GA4", null, "987654321"],
  ])("accepts %s", (_case, site, property) => {
    expect(
      chooseGoogleProperties(google(), { searchConsoleSite: site, ga4PropertyId: property }),
    ).toEqual({
      ok: true,
      value: { ...google(), searchConsoleSite: site, ga4PropertyId: property },
    });
  });

  it.each([
    ["a site that is neither sc-domain nor a URL", "acme.dev", null, "invalid_url"],
    ["an empty sc-domain", "sc-domain:", null, "invalid_url"],
    ["a non-numeric GA4 property", null, "properties/123", "invalid_text"],
  ])("rejects %s", (_case, site, property, code) => {
    const result = chooseGoogleProperties(google(), {
      searchConsoleSite: site,
      ga4PropertyId: property,
    });
    expect(result.ok ? undefined : result.error.code).toBe(code);
  });
});

describe("createPlausibleConnection", () => {
  const input = {
    ...base,
    siteId: " acme.dev ",
    baseUrl: "https://plausible.io",
    encryptedSecret: "v1:iv:tag:ct",
  };

  it("stores the site, the base URL and the encrypted key", () => {
    expect(createPlausibleConnection(input)).toEqual({
      ok: true,
      value: {
        id: "an_1",
        productId: "prod_1",
        provider: "plausible",
        siteId: "acme.dev",
        baseUrl: "https://plausible.io/",
        encryptedSecret: "v1:iv:tag:ct",
        connectedAt: now,
      },
    });
  });

  it.each([
    ["a blank site", { siteId: " " }, "invalid_text"],
    ["a site with a path", { siteId: "acme.dev/blog" }, "invalid_text"],
    ["an invalid base URL", { baseUrl: "plausible" }, "invalid_url"],
    ["a missing key", { encryptedSecret: "" }, "invalid_text"],
  ])("rejects %s", (_case, override, code) => {
    const result = createPlausibleConnection({ ...input, ...override });
    expect(result.ok ? undefined : result.error.code).toBe(code);
  });
});
