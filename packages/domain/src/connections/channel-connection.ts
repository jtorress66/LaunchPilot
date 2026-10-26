import { andThen, map, type Result } from "../result";
import type { DomainError } from "../shared/errors";
import type { ChannelConnectionId, ProductId } from "../shared/ids";
import { nonEmptyText } from "../shared/text";
import { parseHttpUrl, type HttpUrl } from "../shared/url";

/** How Nuvantre reaches a product's own channel, e.g. its WordPress blog. */
export interface ChannelConnection {
  readonly id: ChannelConnectionId;
  readonly productId: ProductId;
  readonly channel: "blog";
  readonly provider: "wordpress";
  readonly siteUrl: HttpUrl;
  readonly siteName: string;
  readonly username: string;
  /** Encrypted by the TokenCipher port; the plaintext is never stored. */
  readonly encryptedSecret: string;
  readonly connectedAt: Date;
}

const hostOf = (url: HttpUrl) => url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

export const createBlogConnection = (input: {
  id: ChannelConnectionId;
  productId: ProductId;
  siteUrl: string;
  siteName: string;
  username: string;
  encryptedSecret: string;
  now: Date;
}): Result<ChannelConnection, DomainError> =>
  andThen(parseHttpUrl(input.siteUrl), (siteUrl) =>
    andThen(nonEmptyText(input.username, { field: "Username", max: 200 }), (username) =>
      map(
        nonEmptyText(input.encryptedSecret, { field: "Application password", max: 4000 }),
        (encryptedSecret) => ({
          id: input.id,
          productId: input.productId,
          channel: "blog" as const,
          provider: "wordpress" as const,
          siteUrl,
          siteName: input.siteName.trim() === "" ? hostOf(siteUrl) : input.siteName.trim(),
          username,
          encryptedSecret,
          connectedAt: input.now,
        }),
      ),
    ),
  );
