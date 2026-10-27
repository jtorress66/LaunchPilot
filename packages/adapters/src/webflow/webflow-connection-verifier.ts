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
import { safeRequest } from "../net/safe-http";
import { bearer, webflowUrl, type WebflowNetwork } from "./webflow-api";

const collectionBody = z.object({
  displayName: z.string(),
  slug: z.string().min(1),
  fields: z.array(z.object({ type: z.string(), slug: z.string() })),
});

/** Plain-text fields that hold a post's summary in Webflow's blog templates. */
const summarySlugs = ["post-summary", "summary", "excerpt"];

/**
 * Checks a site API token against the founder's blog collection, and finds the fields to fill:
 * the Rich Text body (prefer `post-body`) and, if there is one, a summary.
 */
export class WebflowConnectionVerifier implements BlogConnectionVerifier {
  constructor(private readonly network: WebflowNetwork) {}

  async verify({
    siteUrl,
    settings,
    secret,
  }: BlogCredentials): Promise<Result<VerifiedBlog, ConnectionError>> {
    const collectionId = settings.collectionId ?? "";
    const response = await safeRequest(
      webflowUrl(this.network, `v2/collections/${encodeURIComponent(collectionId)}`),
      { method: "GET", headers: bearer(secret) },
      blogHttpOptions(this.network),
    );
    if (!response.ok) return connectFailure(response.error);
    const { status, body } = response.value;
    if (status === 401 || status === 403) {
      return failure("invalid_credentials", "Webflow did not accept that site API token");
    }
    if (status === 404 || status === 400) {
      return failure(
        "invalid_credentials",
        "Webflow has no collection with that ID for this token",
      );
    }
    if (status !== 200) return failure("unreachable", "Webflow is unavailable. Try again.", true);
    const parsed = collectionBody.safeParse(parseJson(body));
    if (!parsed.success) return failure("wrong_platform", "Webflow answered in an unexpected way");

    const { fields, displayName, slug } = parsed.data;
    const richText = fields.filter((field) => field.type === "RichText");
    const bodyField = richText.find((field) => field.slug === "post-body") ?? richText[0];
    if (!bodyField) {
      return failure(
        "wrong_platform",
        `The ${displayName} collection has no Rich Text field for the article`,
      );
    }
    const summaryField = fields.find(
      (field) => field.type === "PlainText" && summarySlugs.includes(field.slug),
    );
    const home = new URL(siteUrl);
    return ok({
      siteName: home.hostname,
      siteUrl: home.toString(),
      settings: {
        ...settings,
        collectionId,
        collectionSlug: slug,
        bodyField: bodyField.slug,
        ...(summaryField ? { summaryField: summaryField.slug } : {}),
      },
    });
  }
}
