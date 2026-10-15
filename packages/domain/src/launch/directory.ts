import type { Channel } from "../channels/channel";
import { andThen, err, map, ok, type Result } from "../result";
import { domainError, type DomainError } from "../shared/errors";
import { nonEmptyText } from "../shared/text";
import { parseHttpUrl, type HttpUrl } from "../shared/url";

export const directoryKinds = ["launch_platform", "directory", "community"] as const;
export type DirectoryKind = (typeof directoryKinds)[number];
export const directoryPricings = ["free", "freemium", "paid"] as const;
export type DirectoryPricing = (typeof directoryPricings)[number];

/** Channels whose content is a post the founder makes in the community itself. */
export const communityChannels = ["hackernews", "reddit", "indiehackers"] as const;
export type CommunityChannel = (typeof communityChannels)[number];

const isCommunityChannel = (channel: Channel): channel is CommunityChannel =>
  (communityChannels as readonly Channel[]).includes(channel);

export interface DirectoryLimits {
  readonly tagline?: number;
  readonly shortDescription?: number;
  readonly longDescription?: number;
}

/** A place a founder can launch or list a product. Curated data, never scraped. */
export interface Directory {
  readonly slug: string;
  readonly name: string;
  readonly kind: DirectoryKind;
  readonly channel: Channel;
  readonly homepageUrl: HttpUrl;
  readonly submitUrl: HttpUrl;
  readonly pricing: DirectoryPricing;
  readonly priceNote: string | null;
  readonly topics: readonly string[];
  readonly limits: DirectoryLimits;
  /** When the entry was last checked against the live site. */
  readonly checkedAt: Date;
}

export interface DirectoryInput {
  readonly slug: string;
  readonly name: string;
  readonly kind: DirectoryKind;
  readonly channel: Channel;
  readonly homepageUrl: string;
  readonly submitUrl: string;
  readonly pricing: DirectoryPricing;
  readonly priceNote: string | null;
  readonly topics: readonly string[];
  readonly limits: DirectoryLimits;
  /** `YYYY-MM-DD`. */
  readonly checkedAt: string;
}

const invalid = (message: string) => err(domainError("invalid_text", message));

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const checkShape = (input: DirectoryInput): Result<null, DomainError> => {
  if (!SLUG.test(input.slug)) return invalid(`"${input.slug}" is not a valid directory slug`);
  if (isCommunityChannel(input.channel) !== (input.kind === "community")) {
    return invalid(`${input.slug}: communities and community channels must go together`);
  }
  const limits = Object.values(input.limits) as number[];
  if (limits.some((limit) => !Number.isInteger(limit) || limit <= 0)) {
    return invalid(`${input.slug}: limits must be positive whole numbers`);
  }
  if (!DAY.test(input.checkedAt) || Number.isNaN(Date.parse(`${input.checkedAt}T00:00:00Z`))) {
    return invalid(`${input.slug}: checkedAt must be a YYYY-MM-DD date`);
  }
  return ok(null);
};

/** Validates one curated directory entry. */
export const parseDirectory = (input: DirectoryInput): Result<Directory, DomainError> =>
  andThen(checkShape(input), () =>
    andThen(nonEmptyText(input.name, { field: "Directory name", max: 100 }), (name) =>
      andThen(parseHttpUrl(input.homepageUrl), (homepageUrl) =>
        map(parseHttpUrl(input.submitUrl), (submitUrl) => ({
          slug: input.slug,
          name,
          kind: input.kind,
          channel: input.channel,
          homepageUrl,
          submitUrl,
          pricing: input.pricing,
          priceNote: input.priceNote,
          topics: [...input.topics],
          limits: { ...input.limits },
          checkedAt: new Date(`${input.checkedAt}T00:00:00.000Z`),
        })),
      ),
    ),
  );

const kindOrder: Readonly<Record<DirectoryKind, number>> = {
  launch_platform: 0,
  directory: 1,
  community: 2,
};

/** Launch platforms first, then directories, then communities; each alphabetically. */
export const filterDirectories = (
  directories: readonly Directory[],
  filter: {
    readonly kind?: DirectoryKind;
    readonly pricing?: DirectoryPricing;
    readonly topic?: string;
  },
): Directory[] =>
  directories
    .filter((d) => filter.kind === undefined || d.kind === filter.kind)
    .filter((d) => filter.pricing === undefined || d.pricing === filter.pricing)
    .filter((d) => filter.topic === undefined || d.topics.includes(filter.topic))
    .sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.name.localeCompare(b.name));
