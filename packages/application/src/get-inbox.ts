import type { ContentItem, Product, Workspace } from "@nuvantre/domain";
import type { ContentItemRepository, ProductRepository } from "@nuvantre/ports";

export interface InboxEntry {
  readonly item: ContentItem;
  readonly product: Product;
}

/** Everything waiting for the founder's review, across products and channels, oldest first. */
export class GetInbox {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly contentItems: ContentItemRepository;
    },
  ) {}

  async execute(input: { workspace: Workspace }): Promise<readonly InboxEntry[]> {
    const products = await this.deps.products.listByWorkspace(input.workspace.id);
    const byId = new Map(products.map((p) => [p.id, p]));
    const items = await this.deps.contentItems.listByStatusForProducts(
      "in_review",
      products.map((p) => p.id),
    );
    return [...items]
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
      .flatMap((item) => {
        const product = byId.get(item.productId);
        return product ? [{ item, product }] : [];
      });
  }
}
