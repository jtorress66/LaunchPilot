import {
  communityChannels,
  fitListing,
  needsFollowUp,
  ok,
  submissionStatuses,
  type Channel,
  type ContentItem,
  type Directory,
  type FittedListing,
  type LaunchKit,
  type Product,
  type ProductId,
  type Result,
  type Submission,
  type SubmissionStatus,
  type Workspace,
} from "@nuvantre/domain";
import type {
  BriefRepository,
  Clock,
  ContentItemRepository,
  DirectoryCatalog,
  LaunchKitRepository,
  ProductRepository,
  SubmissionRepository,
} from "@nuvantre/ports";
import type { UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

export interface TrackerRow {
  readonly submission: Submission;
  readonly directory: Directory;
  /** The listing as this directory needs it; null until a kit exists. */
  readonly fitted: FittedListing | null;
  readonly warnings: readonly string[];
  readonly followUp: boolean;
}

export interface LaunchOverview {
  readonly product: Product;
  readonly briefApproved: boolean;
  readonly kit: LaunchKit | null;
  /** The newest unarchived draft post per community. */
  readonly community: readonly ContentItem[];
  readonly rows: readonly TrackerRow[];
  readonly counts: Readonly<Record<SubmissionStatus, number>>;
}

/** Everything the Launch page shows: the kit, community drafts and the tracker. */
export class GetLaunchOverview {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly briefs: BriefRepository;
      readonly launchKits: LaunchKitRepository;
      readonly contentItems: ContentItemRepository;
      readonly directories: DirectoryCatalog;
      readonly submissions: SubmissionRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<Result<LaunchOverview, UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const id = product.value.id;
    const [brief, kit, items, directories, submissions] = await Promise.all([
      this.deps.briefs.findLatestForProduct(id),
      this.deps.launchKits.findLatestForProduct(id),
      this.deps.contentItems.listByProduct(id),
      this.deps.directories.list(),
      this.deps.submissions.listByProduct(id),
    ]);
    const now = this.deps.clock.now();
    const bySlug = new Map(directories.map((d) => [d.slug, d]));
    // Items come newest first, so the first unarchived one per channel is the current draft.
    const community = (communityChannels as readonly Channel[]).flatMap((channel) =>
      items.filter((i) => i.channel === channel && i.status !== "archived").slice(0, 1),
    );
    const rows = submissions.flatMap((submission) => {
      const directory = bySlug.get(submission.directorySlug);
      if (!directory) return [];
      const fit = kit ? fitListing(kit.listing, directory) : null;
      return [
        {
          submission,
          directory,
          fitted: fit?.fields ?? null,
          warnings: fit?.warnings ?? [],
          followUp: needsFollowUp(submission, now),
        },
      ];
    });
    const counts = Object.fromEntries(
      submissionStatuses.map((status) => [
        status,
        submissions.filter((s) => s.status === status).length,
      ]),
    ) as Record<SubmissionStatus, number>;
    return ok({
      product: product.value,
      briefApproved: brief?.status === "approved",
      kit: kit ?? null,
      community,
      rows,
      counts,
    });
  }
}
