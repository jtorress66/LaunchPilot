import { communityChannels, listingLimits, type Listing } from "@launchpilot/domain";
import type { CommunityDraft } from "@launchpilot/ports";
import { SHOW_HN_TITLE_MAX } from "./prompt";

const textFields: readonly [keyof typeof listingLimits & keyof Listing, string][] = [
  ["name", "Name"],
  ["tagline", "Tagline"],
  ["shortDescription", "Short description"],
  ["longDescription", "Long description"],
  ["makerComment", "Maker comment"],
];

const lengthProblem = (label: string, value: string, limit: number) => {
  const length = value.trim().length;
  if (length === 0) return [`${label} must not be empty.`];
  return length > limit
    ? [`${label} is ${String(length)} characters; the limit is ${String(limit)}.`]
    : [];
};

const listProblems = (
  values: readonly string[],
  bounds: { min: number; max: number },
  message: string,
  label: string,
  limit: number,
) => [
  ...(values.length < bounds.min || values.length > bounds.max ? [message] : []),
  ...values.flatMap((value) => lengthProblem(label, value, limit)),
];

/** Every way a drafted kit breaks the listing limits or community rules, one line each. */
export const kitProblems = (listing: Listing, community: readonly CommunityDraft[]): string[] => [
  ...textFields.flatMap(([field, label]) =>
    lengthProblem(label, listing[field], listingLimits[field]),
  ),
  ...listProblems(
    listing.features,
    { min: 3, max: 6 },
    "List 3 to 6 key features.",
    "Feature",
    listingLimits.feature,
  ),
  ...listProblems(
    listing.categories,
    { min: 1, max: 3 },
    "List 1 to 3 categories.",
    "Category",
    listingLimits.category,
  ),
  ...communityChannels.flatMap((channel) => {
    const post = community.find((p) => p.channel === channel);
    if (!post) return [`Add a ${channel} draft.`];
    return [
      ...lengthProblem(
        `The ${channel} title`,
        post.title,
        channel === "hackernews" ? SHOW_HN_TITLE_MAX : 300,
      ),
      ...lengthProblem(`The ${channel} body`, post.body, 10_000),
      ...(channel === "hackernews" && !post.title.startsWith("Show HN:")
        ? ['The Show HN title must start with "Show HN:".']
        : []),
    ];
  }),
];
