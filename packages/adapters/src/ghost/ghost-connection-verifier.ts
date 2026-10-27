import { ok, type Result } from "@nuvantre/domain";
import type {
  BlogConnectionVerifier,
  BlogCredentials,
  ConnectionError,
  VerifiedBlog,
} from "@nuvantre/ports";
import { z } from "zod";
import {
  blogHttpOptions,
  connectFailure,
  connectionError as failure,
  parseJson,
} from "../blog/blog-http";
import { httpGet, safeRequest } from "../net/safe-http";
import { parseGhostAdminKey } from "./ghost-admin-token";
import { adminHeaders, adminUrl, type GhostNetwork } from "./ghost-api";

const siteInfo = z.object({ site: z.object({ title: z.string().min(1), url: z.string().url() }) });

/** Checks a Ghost site and a custom integration's Admin API key before Nuvantre stores them. */
export class GhostConnectionVerifier implements BlogConnectionVerifier {
  constructor(private readonly network: GhostNetwork) {}

  async verify({
    siteUrl,
    settings,
    secret,
  }: BlogCredentials): Promise<Result<VerifiedBlog, ConnectionError>> {
    const options = blogHttpOptions(this.network);
    const siteResponse = await httpGet(adminUrl(siteUrl, "site/"), options);
    if (!siteResponse.ok) return connectFailure(siteResponse.error);
    const site = siteInfo.safeParse(parseJson(siteResponse.value.body));
    if (siteResponse.value.status !== 200 || !site.success) {
      return failure("wrong_platform", "This address is not a Ghost site");
    }

    const key = parseGhostAdminKey(secret);
    if (!key) {
      return failure(
        "invalid_credentials",
        "That is not a Ghost Admin API key. Copy it from Settings → Integrations.",
      );
    }
    const home = site.data.site.url.endsWith("/") ? site.data.site.url : `${site.data.site.url}/`;
    const posts = await safeRequest(
      adminUrl(home, "posts/", { limit: "1", fields: "id" }),
      { method: "GET", headers: adminHeaders(key, this.network.clock) },
      options,
    );
    if (!posts.ok) return connectFailure(posts.error);
    if (posts.value.status === 401 || posts.value.status === 403) {
      return failure("invalid_credentials", "Ghost did not accept that Admin API key");
    }
    if (posts.value.status !== 200) {
      return failure("wrong_platform", "Ghost answered in an unexpected way", true);
    }
    return ok({ siteName: site.data.site.title, siteUrl: home, settings: { ...settings } });
  }
}
