import { andThen, map, type Result } from "../result";
import { defaultLocale, parseContentLocale, type ContentLocale } from "../seo/content-locale";
import type { DomainError } from "../shared/errors";
import type { ProductId, WorkspaceId } from "../shared/ids";
import { nonEmptyText } from "../shared/text";
import { parseHttpUrl, type HttpUrl } from "../shared/url";

export interface Product {
  readonly id: ProductId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly url: HttpUrl;
  readonly createdAt: Date;
  /** When the founder switched on the weekly autopilot; null while it is off. */
  readonly autopilotSince: Date | null;
  /** The language and market its articles and posts are written for. */
  readonly locale: ContentLocale;
  /** Set while the product is archived: kept, but out of the plan's slots and the switcher. */
  readonly archivedAt: Date | null;
  /** Its place for the plan's product slots; the earliest fill them first. */
  readonly slotOrder: Date;
}

export const createProduct = (input: {
  id: ProductId;
  workspaceId: WorkspaceId;
  name: string;
  url: string;
  now: Date;
}): Result<Product, DomainError> =>
  andThen(nonEmptyText(input.name, { field: "Product name", max: 100 }), (name) =>
    map(parseHttpUrl(input.url), (url) => ({
      id: input.id,
      workspaceId: input.workspaceId,
      name,
      url,
      createdAt: input.now,
      autopilotSince: null,
      locale: defaultLocale,
      archivedAt: null,
      slotOrder: input.now,
    })),
  );

export const setProductLocale = (product: Product, locale: string): Result<Product, DomainError> =>
  map(parseContentLocale(locale), (parsed) => ({ ...product, locale: parsed }));
