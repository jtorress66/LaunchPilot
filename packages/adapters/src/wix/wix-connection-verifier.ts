import { ok, type Result } from "@nuvantre/domain";
import type {
  BlogConnectionVerifier,
  BlogCredentials,
  ConnectionError,
  VerifiedBlog,
} from "@nuvantre/ports";
import { blogHttpOptions, connectFailure, connectionError as failure } from "../blog/blog-http";
import { safeRequest } from "../net/safe-http";
import { wixHeaders, wixUrl, type WixNetwork } from "./wix-api";

/** Checks a Wix API key can read the blog of the site with the founder's site ID. */
export class WixConnectionVerifier implements BlogConnectionVerifier {
  constructor(private readonly network: WixNetwork) {}

  async verify({
    siteUrl,
    settings,
    secret,
  }: BlogCredentials): Promise<Result<VerifiedBlog, ConnectionError>> {
    const response = await safeRequest(
      wixUrl(this.network, "blog/v3/categories?paging.limit=1"),
      { method: "GET", headers: wixHeaders(secret, settings.siteId ?? "") },
      blogHttpOptions(this.network),
    );
    if (!response.ok) return connectFailure(response.error);
    const { status } = response.value;
    if (status === 401 || status === 403) {
      return failure("invalid_credentials", "Wix did not accept that API key for this site");
    }
    if (status === 404 || status === 400) {
      return failure("invalid_credentials", "Wix has no blog on a site with that ID for this key");
    }
    if (status !== 200) return failure("unreachable", "Wix is unavailable. Try again.", true);
    const home = new URL(siteUrl);
    return ok({ siteName: home.hostname, siteUrl: home.toString(), settings: { ...settings } });
  }
}
