import {
  briefId,
  createBrief,
  err,
  reviseBrief,
  type Brief,
  type ProductId,
  type Result,
  type Workspace,
} from "@nuvantre/domain";
import type {
  BriefDraftError,
  BriefDrafter,
  BriefRepository,
  Clock,
  IdGenerator,
  ProductRepository,
  SubscriptionRepository,
  SiteCrawler,
  WorkspaceRepository,
} from "@nuvantre/ports";
import { failure, type UseCaseError } from "./errors";
import { loadActiveProduct } from "./active-product";

export interface GenerateBriefDeps {
  readonly products: ProductRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly workspaces: WorkspaceRepository;
  readonly briefs: BriefRepository;
  readonly crawler: SiteCrawler;
  readonly drafter: BriefDrafter;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

export interface GeneratedBrief {
  readonly brief: Brief;
  /** Claims the drafter removed because the site did not support them. */
  readonly droppedClaims: readonly string[];
}

/**
 * Reads the product's site and drafts its brief. A new draft revises the existing
 * brief, so it always needs the founder's approval again.
 */
export class GenerateBrief {
  constructor(private readonly deps: GenerateBriefDeps) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<Result<GeneratedBrief, UseCaseError | BriefDraftError>> {
    const product = await loadActiveProduct(this.deps, input.workspace, input.productId);
    if (!product.ok) return product;

    const site = await this.deps.crawler.crawl(product.value.url);
    if (!site.ok) return err(failure("crawl_failed", site.error.message));

    const draft = await this.deps.drafter.draft({
      productName: product.value.name,
      site: site.value,
    });
    if (!draft.ok) return draft;

    const now = this.deps.clock.now();
    const existing = await this.deps.briefs.findLatestForProduct(product.value.id);
    const brief = existing
      ? reviseBrief(existing, draft.value.content, { now })
      : createBrief({
          id: briefId(this.deps.ids.next()),
          productId: product.value.id,
          content: draft.value.content,
          now,
        });
    if (!brief.ok) return brief;
    await this.deps.briefs.save(brief.value);
    return { ok: true, value: { brief: brief.value, droppedClaims: draft.value.droppedClaims } };
  }
}
