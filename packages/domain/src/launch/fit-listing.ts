import type { Directory, DirectoryLimits } from "./directory";
import type { Listing } from "./launch-kit";

export type FittedListing = Omit<Listing, "makerComment">;

const labels: Readonly<Record<keyof DirectoryLimits, string>> = {
  tagline: "Tagline",
  shortDescription: "Short description",
  longDescription: "Long description",
};

/**
 * The listing as one directory needs it. Text is never cut: a field over the directory's own
 * limit becomes a warning, so the founder decides how to shorten it.
 */
export const fitListing = (
  listing: Listing,
  directory: Directory,
): { readonly fields: FittedListing; readonly warnings: readonly string[] } => ({
  fields: {
    name: listing.name,
    tagline: listing.tagline,
    shortDescription: listing.shortDescription,
    longDescription: listing.longDescription,
    features: listing.features,
    categories: listing.categories,
  },
  warnings: (Object.keys(labels) as (keyof DirectoryLimits)[]).flatMap((field) => {
    const limit = directory.limits[field];
    const length = listing[field].length;
    return limit !== undefined && length > limit
      ? [
          `${labels[field]} is ${String(length)} characters; ${directory.name} allows ${String(limit)}.`,
        ]
      : [];
  }),
});
