import { andThen, map, type Result } from "../result";
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
    })),
  );
