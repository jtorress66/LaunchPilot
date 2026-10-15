import {
  channels,
  directoryKinds,
  directoryPricings,
  launchKitId,
  launchKitStatuses,
  parseHttpUrl,
  productId,
  submissionId,
  submissionStatuses,
  userId,
  type Directory,
  type DirectoryLimits,
  type HttpUrl,
  type LaunchKit,
  type Listing,
  type Submission,
} from "@launchpilot/domain";
import type { DirectoryRow, LaunchKitRow, SubmissionRow } from "../schema";
import { oneOf, readJson, toJson } from "./columns";

const readUrl = (value: string, column: string): HttpUrl => {
  const url = parseHttpUrl(value);
  if (!url.ok) throw new Error(`Unexpected value "${value}" in ${column}`);
  return url.value;
};

export const directoryMapper = {
  toRow: (d: Directory): DirectoryRow => ({
    slug: d.slug,
    name: d.name,
    kind: d.kind,
    channel: d.channel,
    homepage_url: d.homepageUrl,
    submit_url: d.submitUrl,
    pricing: d.pricing,
    price_note: d.priceNote,
    topics: toJson(d.topics),
    limits: toJson(d.limits),
    checked_at: d.checkedAt,
  }),
  fromRow: (row: DirectoryRow): Directory => ({
    slug: row.slug,
    name: row.name,
    kind: oneOf(directoryKinds, row.kind, "directories.kind"),
    channel: oneOf(channels, row.channel, "directories.channel"),
    homepageUrl: readUrl(row.homepage_url, "directories.homepage_url"),
    submitUrl: readUrl(row.submit_url, "directories.submit_url"),
    pricing: oneOf(directoryPricings, row.pricing, "directories.pricing"),
    priceNote: row.price_note,
    topics: readJson(row.topics) as string[],
    limits: readJson(row.limits) as DirectoryLimits,
    checkedAt: row.checked_at,
  }),
};

export const launchKitMapper = {
  toRow: (kit: LaunchKit): LaunchKitRow => ({
    id: kit.id,
    product_id: kit.productId,
    version: kit.version,
    status: kit.status,
    listing: toJson(kit.listing),
    approved_by: kit.approval?.by ?? null,
    approved_at: kit.approval?.at ?? null,
    updated_at: kit.updatedAt,
  }),
  fromRow: (row: LaunchKitRow): LaunchKit => ({
    id: launchKitId(row.id),
    productId: productId(row.product_id),
    version: row.version,
    status: oneOf(launchKitStatuses, row.status, "launch_kits.status"),
    listing: readJson(row.listing) as Listing,
    approval:
      row.approved_by !== null && row.approved_at !== null
        ? { by: userId(row.approved_by), at: row.approved_at }
        : null,
    updatedAt: row.updated_at,
  }),
};

interface StoredRejection {
  readonly reason: string;
  readonly at: string;
}

export const submissionMapper = {
  toRow: (s: Submission): SubmissionRow => ({
    id: s.id,
    product_id: s.productId,
    directory_slug: s.directorySlug,
    status: s.status,
    submitted_at: s.submittedAt,
    listing_url: s.live?.listingUrl ?? null,
    live_at: s.live?.at ?? null,
    rejection:
      s.rejection === null
        ? null
        : toJson({
            reason: s.rejection.reason,
            at: s.rejection.at.toISOString(),
          } satisfies StoredRejection),
    updated_at: s.updatedAt,
  }),
  fromRow: (row: SubmissionRow): Submission => {
    const rejection = row.rejection === null ? null : (readJson(row.rejection) as StoredRejection);
    return {
      id: submissionId(row.id),
      productId: productId(row.product_id),
      directorySlug: row.directory_slug,
      status: oneOf(submissionStatuses, row.status, "submissions.status"),
      submittedAt: row.submitted_at,
      live:
        row.listing_url !== null && row.live_at !== null
          ? { listingUrl: readUrl(row.listing_url, "submissions.listing_url"), at: row.live_at }
          : null,
      rejection:
        rejection === null ? null : { reason: rejection.reason, at: new Date(rejection.at) },
      updatedAt: row.updated_at,
    };
  },
};
