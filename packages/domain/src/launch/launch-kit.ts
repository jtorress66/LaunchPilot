import { all, andThen, err, ok, type Result } from "../result";
import type { Actor } from "../shared/actor";
import { domainError, type DomainError } from "../shared/errors";
import type { LaunchKitId, ProductId, UserId } from "../shared/ids";
import { applyTransition, defineTransitions } from "../shared/state-machine";
import { nonEmptyText } from "../shared/text";

/** The listing copy a founder pastes into launch platforms and directories. */
export interface Listing {
  readonly name: string;
  readonly tagline: string;
  readonly shortDescription: string;
  readonly longDescription: string;
  readonly features: readonly string[];
  readonly categories: readonly string[];
  /** The maker's first comment on Product Hunt and similar launch pages. */
  readonly makerComment: string;
}

/** Character limits that fit the strictest common launch platforms. */
export const listingLimits = {
  name: 60,
  tagline: 60,
  shortDescription: 160,
  longDescription: 1000,
  feature: 120,
  category: 40,
  makerComment: 1000,
} as const;

const FEATURES = { min: 3, max: 6 };
const CATEGORIES = { min: 1, max: 3 };

export const launchKitStatuses = ["draft", "approved"] as const;
export type LaunchKitStatus = (typeof launchKitStatuses)[number];

export interface LaunchKit {
  readonly id: LaunchKitId;
  readonly productId: ProductId;
  /** Bumped on every edit, so an approval always names the revision it covers. */
  readonly version: number;
  readonly status: LaunchKitStatus;
  readonly listing: Listing;
  readonly approval: { readonly by: UserId; readonly at: Date } | null;
  readonly updatedAt: Date;
}

const machine = defineTransitions<LaunchKitStatus, "approve" | "edit">({
  draft: { approve: "approved", edit: "draft" },
  approved: { edit: "draft" },
});

const text = (value: string, field: string, max: number) => nonEmptyText(value, { field, max });

const list = (
  values: readonly string[],
  bounds: { min: number; max: number },
  message: string,
  field: string,
  max: number,
) =>
  values.length < bounds.min || values.length > bounds.max
    ? err(domainError("invalid_text", message))
    : all(values.map((value) => text(value, field, max)));

/** Validates every field; the first problem found is reported. */
export const validateListing = (listing: Listing): Result<Listing, DomainError> =>
  andThen(text(listing.name, "Name", listingLimits.name), (name) =>
    andThen(text(listing.tagline, "Tagline", listingLimits.tagline), (tagline) =>
      andThen(
        text(listing.shortDescription, "Short description", listingLimits.shortDescription),
        (shortDescription) =>
          andThen(
            text(listing.longDescription, "Long description", listingLimits.longDescription),
            (longDescription) =>
              andThen(
                list(
                  listing.features,
                  FEATURES,
                  "List 3 to 6 key features",
                  "Feature",
                  listingLimits.feature,
                ),
                (features) =>
                  andThen(
                    list(
                      listing.categories,
                      CATEGORIES,
                      "List 1 to 3 categories",
                      "Category",
                      listingLimits.category,
                    ),
                    (categories) =>
                      andThen(
                        text(listing.makerComment, "Maker comment", listingLimits.makerComment),
                        (makerComment) =>
                          ok({
                            name,
                            tagline,
                            shortDescription,
                            longDescription,
                            features,
                            categories,
                            makerComment,
                          }),
                      ),
                  ),
              ),
          ),
      ),
    ),
  );

export const createLaunchKit = (input: {
  id: LaunchKitId;
  productId: ProductId;
  listing: Listing;
  now: Date;
}): Result<LaunchKit, DomainError> =>
  andThen(validateListing(input.listing), (listing) =>
    ok({
      id: input.id,
      productId: input.productId,
      version: 1,
      status: "draft" as const,
      listing,
      approval: null,
      updatedAt: input.now,
    }),
  );

/** Any edit is a new version that needs the founder's approval again. */
export const editLaunchKit = (
  kit: LaunchKit,
  listing: Listing,
  { now }: { now: Date },
): Result<LaunchKit, DomainError> =>
  andThen(applyTransition(machine, kit.status, "edit"), (status) =>
    andThen(validateListing(listing), (valid) =>
      ok({
        ...kit,
        listing: valid,
        status,
        version: kit.version + 1,
        approval: null,
        updatedAt: now,
      }),
    ),
  );

export const approveLaunchKit = (
  kit: LaunchKit,
  actor: Actor,
  { now }: { now: Date },
): Result<LaunchKit, DomainError> =>
  andThen(applyTransition(machine, kit.status, "approve"), (status) =>
    actor.kind === "founder"
      ? ok({ ...kit, status, approval: { by: actor.userId, at: now }, updatedAt: now })
      : err(
          domainError("approval_requires_founder", "Only the founder can approve the launch kit"),
        ),
  );
