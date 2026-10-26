import { err, ok, type Result } from "@nuvantre/domain";
import type {
  AnalyticsProperties,
  AnalyticsPropertyLister,
  PropertyListError,
} from "@nuvantre/ports";
import { z } from "zod";
import { accessTokenFor } from "./access-token";
import { apiFailure, callGoogle, unreachable, urlsOf, type GoogleOptions } from "./api";

const siteList = z.object({
  siteEntry: z.array(z.object({ siteUrl: z.string(), permissionLevel: z.string() })).default([]),
});

const summaries = z.object({
  accountSummaries: z
    .array(
      z.object({
        displayName: z.string(),
        propertySummaries: z
          .array(z.object({ property: z.string(), displayName: z.string() }))
          .default([]),
      }),
    )
    .default([]),
  nextPageToken: z.string().optional(),
});

const MAX_PAGES = 5;

const asListError = (error: { code: string; message: string; retryable: boolean }) =>
  err<PropertyListError>({
    code: error.code === "invalid_credentials" ? "invalid_credentials" : "unavailable",
    message: error.message,
    retryable: error.retryable,
  });

/** Lists the verified Search Console sites and GA4 properties a Google account can read. */
export class GooglePropertyLister implements AnalyticsPropertyLister {
  constructor(private readonly options: GoogleOptions) {}

  async list(refreshToken: string): Promise<Result<AnalyticsProperties, PropertyListError>> {
    const token = await accessTokenFor(this.options, refreshToken);
    if (!token.ok) return asListError(token.error);
    const [sites, properties] = await Promise.all([
      this.sites(token.value),
      this.properties(token.value),
    ]);
    if (!sites.ok) return sites;
    if (!properties.ok) return properties;
    return ok({ searchConsoleSites: sites.value, ga4Properties: properties.value });
  }

  private async sites(accessToken: string) {
    const response = await callGoogle(this.options, {
      method: "GET",
      url: `${urlsOf(this.options).searchConsole}/sites`,
      accessToken,
    });
    if (!response.ok) return asListError(unreachable("Search Console"));
    const parsed = siteList.safeParse(response.value.body);
    if (response.value.status !== 200 || !parsed.success) {
      return asListError(apiFailure(response.value.status, response.value.body, "site list"));
    }
    return ok(
      parsed.data.siteEntry
        .filter((s) => s.permissionLevel !== "siteUnverifiedUser")
        .map((s) => ({ siteUrl: s.siteUrl })),
    );
  }

  private async properties(accessToken: string) {
    const found: { id: string; name: string; account: string }[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(`${urlsOf(this.options).analyticsAdmin}/accountSummaries`);
      url.searchParams.set("pageSize", "200");
      if (pageToken !== undefined) url.searchParams.set("pageToken", pageToken);
      const response = await callGoogle(this.options, {
        method: "GET",
        url: url.toString(),
        accessToken,
      });
      if (!response.ok) return asListError(unreachable("Analytics"));
      const parsed = summaries.safeParse(response.value.body);
      if (response.value.status !== 200 || !parsed.success) {
        return asListError(apiFailure(response.value.status, response.value.body, "property list"));
      }
      for (const account of parsed.data.accountSummaries) {
        for (const p of account.propertySummaries) {
          found.push({
            id: p.property.replace(/^properties\//, ""),
            name: p.displayName,
            account: account.displayName,
          });
        }
      }
      pageToken = parsed.data.nextPageToken;
      if (pageToken === undefined || pageToken === "") break;
    }
    return ok(found);
  }
}
