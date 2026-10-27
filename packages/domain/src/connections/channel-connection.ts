import { all, andThen, err, map, ok, type Result } from "../result";
import { domainError, type DomainError } from "../shared/errors";
import type { ChannelConnectionId, ProductId } from "../shared/ids";
import { nonEmptyText } from "../shared/text";
import { parseHttpUrl, type HttpUrl } from "../shared/url";
import { blogPlatforms, isBlogPlatform, type BlogPlatform } from "./blog-platform";

/** How Nuvantre reaches a product's own channel, e.g. its Ghost or WordPress blog. */
export interface ChannelConnection {
  readonly id: ChannelConnectionId;
  readonly productId: ProductId;
  readonly channel: "blog";
  readonly provider: BlogPlatform;
  readonly siteUrl: HttpUrl;
  readonly siteName: string;
  /** Non-secret values: the WordPress username, a Webflow collection ID, a Shopify blog, … */
  readonly settings: Readonly<Record<string, string>>;
  /** Encrypted by the TokenCipher port; the plaintext is never stored. */
  readonly encryptedSecret: string;
  readonly connectedAt: Date;
}

const MAX_SETTING = 500;

const hostOf = (url: HttpUrl) => url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

/** A value the founder typed for this field (required), or one a verifier resolved (optional). */
const validSetting = (key: string, value: string, label: string | undefined) => {
  if (label !== undefined) return nonEmptyText(value, { field: label, max: MAX_SETTING });
  const trimmed = value.trim();
  return trimmed.length > MAX_SETTING
    ? err(domainError("invalid_text", `${key} must be at most ${MAX_SETTING} characters`))
    : ok(trimmed);
};

/** Every setting trimmed and capped; the platform's own fields must not be blank. */
const validSettings = (
  platform: BlogPlatform,
  settings: Readonly<Record<string, string>>,
): Result<Record<string, string>, DomainError> => {
  const labels = new Map(blogPlatforms[platform].fields.map((f) => [f.key, f.label]));
  const keys = [...new Set([...labels.keys(), ...Object.keys(settings)])];
  return map(
    all(
      keys.map((key) =>
        map(validSetting(key, settings[key] ?? "", labels.get(key)), (v) => [key, v] as const),
      ),
    ),
    (entries) => Object.fromEntries(entries.filter(([, value]) => value !== "")),
  );
};

export const createBlogConnection = (input: {
  id: ChannelConnectionId;
  productId: ProductId;
  platform: string;
  siteUrl: string;
  siteName: string;
  settings: Readonly<Record<string, string>>;
  encryptedSecret: string;
  now: Date;
}): Result<ChannelConnection, DomainError> => {
  const { platform } = input;
  if (!isBlogPlatform(platform)) {
    return err(domainError("unknown_platform", `Nuvantre does not publish to "${platform}" yet`));
  }
  return andThen(parseHttpUrl(input.siteUrl), (siteUrl) =>
    andThen(validSettings(platform, input.settings), (settings) =>
      map(
        nonEmptyText(input.encryptedSecret, {
          field: blogPlatforms[platform].secret.label,
          max: 4000,
        }),
        (encryptedSecret) => ({
          id: input.id,
          productId: input.productId,
          channel: "blog" as const,
          provider: platform,
          siteUrl,
          siteName: input.siteName.trim() === "" ? hostOf(siteUrl) : input.siteName.trim(),
          settings,
          encryptedSecret,
          connectedAt: input.now,
        }),
      ),
    ),
  );
};
