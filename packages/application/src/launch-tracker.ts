import {
  createSubmission,
  err,
  filterDirectories,
  ok,
  submissionId,
  transitionSubmission,
  type Directory,
  type DirectoryKind,
  type DirectoryPricing,
  type ProductId,
  type Result,
  type Submission,
  type SubmissionEvent,
  type SubmissionId,
  type Workspace,
} from "@nuvantre/domain";
import type {
  Clock,
  ContentItemRepository,
  DirectoryCatalog,
  IdGenerator,
  LaunchKitRepository,
  ProductRepository,
  SubmissionRepository,
} from "@nuvantre/ports";
import { failure, type UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

export interface DirectoryEntry {
  readonly directory: Directory;
  /** True when this product already has the directory on its tracker. */
  readonly tracked: boolean;
}

/** The curated catalogue, filtered, with the directories this product already tracks. */
export class ListDirectories {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly directories: DirectoryCatalog;
      readonly submissions: SubmissionRepository;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
    filter: { kind?: DirectoryKind; pricing?: DirectoryPricing; topic?: string };
  }): Promise<Result<DirectoryEntry[], UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const [directories, submissions] = await Promise.all([
      this.deps.directories.list(),
      this.deps.submissions.listByProduct(product.value.id),
    ]);
    const tracked = new Set(submissions.map((s) => s.directorySlug));
    return ok(
      filterDirectories(directories, input.filter).map((directory) => ({
        directory,
        tracked: tracked.has(directory.slug),
      })),
    );
  }
}

/** Puts a directory on the product's tracker; adding it twice keeps the one row. */
export class AddToLaunch {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly directories: DirectoryCatalog;
      readonly submissions: SubmissionRepository;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
    directorySlug: string;
  }): Promise<Result<Submission, UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const directory = await this.deps.directories.findBySlug(input.directorySlug);
    if (!directory) return err(failure("directory_not_found", "This directory does not exist"));
    const existing = await this.deps.submissions.findByProductAndDirectory(
      product.value.id,
      directory.slug,
    );
    if (existing) return ok(existing);
    const submission = createSubmission({
      id: submissionId(this.deps.ids.next()),
      productId: product.value.id,
      directorySlug: directory.slug,
      now: this.deps.clock.now(),
    });
    await this.deps.submissions.save(submission);
    return ok(submission);
  }
}

/**
 * Records what the founder did on a directory. Submitting needs the approved launch kit, and for
 * a community, the founder's approved draft post for it.
 */
export class UpdateSubmission {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly directories: DirectoryCatalog;
      readonly submissions: SubmissionRepository;
      readonly launchKits: LaunchKitRepository;
      readonly contentItems: ContentItemRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    submissionId: SubmissionId;
    event: SubmissionEvent;
  }): Promise<Result<Submission, UseCaseError>> {
    const submission = await this.deps.submissions.findById(input.submissionId);
    const product = submission && (await this.deps.products.findById(submission.productId));
    if (!submission || product?.workspaceId !== input.workspace.id) {
      return err(failure("submission_not_found", "This tracker row does not exist"));
    }
    const [kit, directory, items] = await Promise.all([
      this.deps.launchKits.findLatestForProduct(product.id),
      this.deps.directories.findBySlug(submission.directorySlug),
      this.deps.contentItems.listByProduct(product.id),
    ]);
    const communityDraftApproved =
      directory?.kind === "community"
        ? items.some((i) => i.channel === directory.channel && i.status === "approved")
        : undefined;
    const next = transitionSubmission(submission, input.event, {
      now: this.deps.clock.now(),
      kitApproved: kit?.status === "approved",
      ...(communityDraftApproved === undefined ? {} : { communityDraftApproved }),
    });
    if (next.ok) await this.deps.submissions.save(next.value);
    return next;
  }
}
